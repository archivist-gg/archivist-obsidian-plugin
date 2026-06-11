import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { BUILDER_STEPS } from "./builder-steps";
import { renderEntityPicker } from "./builder/entity-picker";
import { renderRaceStep } from "./builder/race-step";
import { renderDecisionLedger } from "./builder/decision-ledger";
import { stripSlug } from "../pc.resolver";
import { buildDecisionLedger, wikilinkTailSlug, bareEntitySlug } from "../pc.decision-engine";

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
    bar.createDiv({ cls: "pc-builder-avatar" });
    bar.createDiv({ cls: "pc-builder-title", text: `Create Character: ${name}` });
    const sum = bar.createDiv({ cls: "pc-builder-summary" });
    const lvl = ctx.derived?.totalLevel ?? 0;
    sum.createSpan({ cls: "pc-builder-sum-item", text: `Lv ${lvl}` });
    sum.createSpan({ cls: "pc-builder-sum-item", text: `Prof +${ctx.derived?.proficiencyBonus ?? 2}` });

    const layout = root.createDiv({ cls: "pc-builder-layout" });

    // Step rail.
    const rail = layout.createDiv({ cls: "pc-builder-rail" });
    for (const [i, step] of BUILDER_STEPS.entries()) {
      const item = rail.createDiv({
        cls: `pc-builder-step${step.id === activeStep ? " active" : ""}`,
        attr: { "data-step": step.id },
      });
      item.createSpan({ cls: "pc-builder-step-n", text: String(i + 1) });
      item.createSpan({ cls: "pc-builder-step-label", text: step.label });
      item.addEventListener("click", () => this.goTo(step.id, el, ctx));
    }

    // Active step body (placeholder; later plans render the real step here).
    const main = layout.createDiv({ cls: "pc-builder-main" });
    const body = main.createDiv({ cls: "pc-builder-body", attr: { "data-step": activeStep } });
    const def = BUILDER_STEPS.find((s) => s.id === activeStep)!;
    body.createDiv({ cls: "pc-builder-step-h", text: def.label });
    if (def.id === "race" && ctx.core) {
      renderRaceStep(body, ctx);
    } else if (def.id === "class" && ctx.core) {
      this.renderClassStep(body, ctx);
    } else {
      body.createDiv({ cls: "pc-builder-placeholder", text: `${def.label} — coming in a later plan` });
    }

    // Footer.
    const foot = main.createDiv({ cls: "pc-builder-foot" });
    const idx = BUILDER_STEPS.findIndex((s) => s.id === activeStep);
    if (idx > 0) {
      const back = foot.createEl("button", { cls: "pc-builder-back", text: "◂ Back" });
      back.addEventListener("click", () => this.goTo(BUILDER_STEPS[idx - 1].id, el, ctx));
    }
    if (idx < BUILDER_STEPS.length - 1) {
      const next = foot.createEl("button", { cls: "pc-builder-next", text: "Next ▸" });
      next.addEventListener("click", () => this.goTo(BUILDER_STEPS[idx + 1].id, el, ctx));
    } else {
      // Finish flips the draft to the full sheet by dropping the `builder` flag
      // (finishBuild → isBuilder false on the next render). A class is the one
      // hard requirement, so gate Finish on it with a title hint rather than
      // letting the user finish into a class-less, unusable sheet.
      const classed = (ctx.resolved.definition?.class?.length ?? 0) > 0;
      const finish = foot.createEl("button", { cls: "pc-builder-finish", text: "✓ Finish & open sheet" });
      finish.disabled = !classed;
      if (!classed) finish.title = "Pick a class before finishing.";
      finish.addEventListener("click", () => ctx.editState?.finishBuild());
    }
  }

  /** SP2 Plan 3 / Task 17 — the minimal Class step: a class entity-picker, a
   *  level dropdown, the live decision ledger, and the orphan-subclass data ask.
   *  The full multiclass step (multiple class entries, per-class subclass UI)
   *  arrives in Plan 5; this is the engine→UI→persistence proof for class 0. */
  private renderClassStep(body: HTMLElement, ctx: ComponentRenderContext): void {
    // The definition entry is the source of truth for slug + level (resolved.classes
    // may have a null `entity` for an unrecognized slug; the picker still needs the
    // chosen slug to mark the selected seal).
    const entry = ctx.resolved.definition.class[0] as
      | { name: string; level: number }
      | undefined;
    renderEntityPicker(body, ctx, {
      entityType: "class",
      stateKey: "builder.class-picker",
      selectedSlug: entry ? stripSlug(entry.name) : null,
      onSelect: (slug) => {
        if (!ctx.editState) return;
        // No setClass mutator exists (Plan 1 shipped add/remove/setLevel/setSubclass).
        // To swap class 0 we remove + re-add, threading the prior level so the swap
        // preserves it — replace-with-level-reset would surprise a mid-build user.
        if (entry) {
          ctx.editState.removeClass(0);
          ctx.editState.addClass(slug, entry.level);
        } else {
          ctx.editState.addClass(slug);
        }
      },
    });
    this.renderOrphanSubclasses(body, ctx);
    if (!entry) return;

    const lvlRow = body.createDiv({ cls: "pc-bclass-levelrow" });
    lvlRow.createSpan({ cls: "pc-bclass-levellabel", text: "Level" });
    const sel = lvlRow.createEl("select", { cls: "pc-bclass-level" });
    for (let i = 1; i <= 20; i++) {
      const o = sel.createEl("option", { text: String(i), attr: { value: String(i) } });
      if (i === entry.level) o.selected = true;
    }
    sel.addEventListener("change", () => ctx.editState?.setClassLevel(0, Number(sel.value)));

    const ledger = buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities });
    renderDecisionLedger(body, ctx, { ledger, classIndex: 0, stateKey: "builder.class-ledger" });
  }

  /** Orphan-subclass data ask (spec §11): a subclass whose `parent_class` tail
   *  resolves to no class entity is registered-but-unoffered. We name the gap and
   *  ask the user to add the class note. Plan 6 upgrades this to the AI hand-off. */
  private renderOrphanSubclasses(body: HTMLElement, ctx: ComponentRenderContext): void {
    // Key on bareEntitySlug(slug) like the engine's parent_class==="self" filter
    // (matchesFilter in pc.decision-engine) so the callout never false-positives
    // when a homebrew class's display name ≠ slug. Keep the name tail as a
    // secondary alias since a subclass may also link the display name.
    const classSlugs = new Set<string>();
    for (const c of ctx.core.entities.search("", "class", Number.POSITIVE_INFINITY)) {
      classSlugs.add(bareEntitySlug(c.slug));
      classSlugs.add(wikilinkTailSlug(`[[${c.name}]]`));
    }
    const orphans = ctx.core.entities
      .search("", "subclass", Number.POSITIVE_INFINITY)
      .filter((s) => {
        const pc = (s.data as { parent_class?: string }).parent_class;
        return pc ? !classSlugs.has(wikilinkTailSlug(pc)) : false;
      });
    for (const o of orphans) {
      const pc = (o.data as { parent_class?: string }).parent_class ?? "?";
      body.createDiv({
        cls: "pc-bclass-orphan",
        text:
          `${o.name} requires the class "${wikilinkTailSlug(pc)}", which isn't in your vault` +
          ` — add the class note to enable it.`,
      });
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
