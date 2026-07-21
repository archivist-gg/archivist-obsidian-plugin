import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { BUILDER_STEPS } from "./builder-steps";
import { renderRaceStep } from "./builder/race-step";
import { renderClassStep } from "./builder/class-step";
import { renderBackgroundStep } from "./builder/background-step";
import { renderAbilitiesStep } from "./builder/abilities-step";
import { renderDetailsStep, getHpSeedChoice } from "./builder/details-step";
import { renderEquipmentStep } from "./builder/equipment-step";
import { stripSlug } from "@archivist-gg/dnd5e/pc/pc.resolver";
import { humanizeSlug } from "../../../shared/rendering/renderer-utils";
import { renderAvatarContent } from "./avatar-content";

/** The full-screen Character Builder shell. Rendered by renderPCSheet in place
 *  of the sheet body when the character has no class. Step bodies are filled in
 *  by later plans; this shell owns the rail, routing, and footer. */
export class BuilderView implements SheetComponent {
  readonly type = "builder";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const activeStep =
      ctx.activeStepId && BUILDER_STEPS.some((s) => s.id === ctx.activeStepId)
        ? ctx.activeStepId
        : BUILDER_STEPS[0].id;
    const root = el.createDiv({ cls: "pc-builder" });

    // Top bar with a live summary.
    const name = ctx.resolved.definition?.name ?? "New Character";
    const bar = root.createDiv({ cls: "pc-builder-topbar" });
    const av = bar.createDiv({ cls: "pc-builder-avatar" });
    renderAvatarContent(av, ctx.portraitUrl, ctx.portraitCrop);
    bar.createDiv({ cls: "pc-builder-title", text: `Create Character: ${name}` });
    const sum = bar.createDiv({ cls: "pc-builder-summary" });
    const lvl = ctx.derived?.totalLevel ?? 0;
    sum.createSpan({ cls: "pc-builder-sum-item", text: `Lv ${lvl}` });
    sum.createSpan({ cls: "pc-builder-sum-item", text: `Prof +${ctx.derived?.proficiencyBonus ?? 2}` });

    const layout = root.createDiv({ cls: "pc-builder-layout" });

    // Step rail.
    const rail = layout.createDiv({ cls: "pc-builder-rail" });
    for (const [i, step] of BUILDER_STEPS.entries()) {
      const done = this.isStepDone(step.id, ctx);
      const item = rail.createDiv({
        cls: `pc-builder-step${step.id === activeStep ? " active" : ""}${done ? " done" : ""}`,
        attr: { "data-step": step.id },
      });
      item.createSpan({ cls: "pc-builder-step-n", text: done ? "✓" : String(i + 1) });
      item.createSpan({ cls: "pc-builder-step-label", text: step.label });
      if (step.id === "class") {
        const classes = ctx.resolved.definition?.class ?? [];
        if (classes.length) {
          item.createSpan({
            cls: "pc-builder-step-badge",
            text: classes
              .map((c) => {
                const slug = stripSlug(c.name);
                const name =
                  (slug && ctx.services?.entities.getByTypeAndSlug("class", slug)?.name) ??
                  humanizeSlug(slug ?? "?");
                return `${name} ${c.level}`;
              })
              .join(" · "),
          });
        }
      }
      item.addEventListener("click", () => this.goTo(step.id, el, ctx));
    }

    // Active step body (placeholder; later plans render the real step here).
    const main = layout.createDiv({ cls: "pc-builder-main" });
    const body = main.createDiv({ cls: "pc-builder-body", attr: { "data-step": activeStep } });
    const def = BUILDER_STEPS.find((s) => s.id === activeStep)!;
    body.createDiv({ cls: "pc-builder-step-h", text: def.label });
    if (def.id === "race" && ctx.services) {
      renderRaceStep(body, ctx);
    } else if (def.id === "class" && ctx.services) {
      renderClassStep(body, ctx);
    } else if (def.id === "abilities" && ctx.services) {
      renderAbilitiesStep(body, ctx);
    } else if (def.id === "background" && ctx.services) {
      renderBackgroundStep(body, ctx);
    } else if (def.id === "equipment" && ctx.services) {
      renderEquipmentStep(body, ctx);
    } else if (def.id === "details") {
      renderDetailsStep(body, ctx);
    } else {
      body.createDiv({ cls: "pc-builder-placeholder", text: `${def.label} — coming in a later plan` });
    }

    // Footer.
    const foot = main.createDiv({ cls: "pc-builder-foot" });
    const idx = BUILDER_STEPS.findIndex((s) => s.id === activeStep);
    if (idx > 0) {
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- button label; leading glyph misleads the rule into lowercasing the first word
      const back = foot.createEl("button", { cls: "pc-builder-back", text: "◂ Back" });
      back.addEventListener("click", () => this.goTo(BUILDER_STEPS[idx - 1].id, el, ctx));
    }
    if (idx < BUILDER_STEPS.length - 1) {
      // A class is the one hard requirement; gate Next out of the class-less Class
      // step with a quiet serif hint (Back, hint, Next) and a title — never on any
      // other step (the permissive D4 model). Hint goes in BEFORE Next so it takes
      // the footer's auto margin and the layout reads Back … hint Next.
      const classed = (ctx.resolved.definition?.class?.length ?? 0) > 0;
      const gate = activeStep === "class" && !classed;
      if (gate) foot.createSpan({ cls: "pc-builder-foot-hint", text: "pick a class first" });
      const next = foot.createEl("button", { cls: "pc-builder-next", text: "Next ▸" });
      if (gate) {
        next.disabled = true;
        next.title = "Pick a class before moving on.";
      }
      next.addEventListener("click", () => this.goTo(BUILDER_STEPS[idx + 1].id, el, ctx));
    } else {
      // Finish flips the draft to the full sheet by dropping the `builder` flag
      // (finishBuild → isBuilder false on the next render). A class is the one
      // hard requirement, so gate Finish on it with a title hint rather than
      // letting the user finish into a class-less, unusable sheet.
      const classed = (ctx.resolved.definition?.class?.length ?? 0) > 0;
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- button label; leading glyph misleads the rule into lowercasing the first word
      const finish = foot.createEl("button", { cls: "pc-builder-finish", text: "✓ Finish & open sheet" });
      finish.disabled = !classed;
      if (!classed) finish.title = "Pick a class before finishing.";
      finish.addEventListener("click", () => {
        if (!ctx.editState) return;
        // Seed the survival numbers a finished sheet needs — finishBuild last.
        // D10: HP per the Details-step choice; Average is the default. Either
        // way the finished sheet never opens at 0 HP.
        ctx.editState.seedHitDice();
        const hp = getHpSeedChoice(ctx);
        if (hp.mode === "manual" && hp.value != null && hp.value > 0) {
          ctx.editState.setHpMax(hp.value);
        } else {
          ctx.editState.seedHpToMax();
        }
        ctx.editState.finishBuild();
      });
    }
  }

  /** Advisory rail ✓ (D4, permissive model — never blocks navigation): steps
   *  with a clear single criterion mark done; the amber "!" is a house-rule no-op
   *  on the rail. Details is the Finish step (all fields optional) and never does.
   *  Note: a manual user who typed scores GETS the abilities ✓ — intended. */
  private isStepDone(id: string, ctx: ComponentRenderContext): boolean {
    const d = ctx.resolved.definition;
    switch (id) {
      case "race":
        return !!d.race;
      case "class":
        return (d.class?.length ?? 0) > 0;
      case "background":
        return !!d.background;
      case "abilities":
        return (
          d.ability_method !== "manual" ||
          Object.values(d.abilities ?? {}).some((v) => v !== 10)
        );
      case "equipment":
        return (d.equipment?.length ?? 0) > 0;
      default:
        return false;
    }
  }

  private goTo(step: string, el: HTMLElement, ctx: ComponentRenderContext): void {
    // Unlike the activeTabId/TabsContainer pattern (callback + CSS toggle only),
    // step nav triggers no parent re-render, so we self-redraw here. The callback
    // still fires to keep parent state in sync for the eventual full re-render.
    ctx.onActiveStepChange?.(step);
    el.empty();
    this.render(el, { ...ctx, activeStepId: step });
  }
}
