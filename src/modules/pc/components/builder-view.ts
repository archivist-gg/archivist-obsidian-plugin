import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { RegisteredEntity } from "../../../shared/entities/entity-registry";
import { BUILDER_STEPS } from "./builder-steps";
import { renderEntityPicker } from "./builder/entity-picker";
import type { ColSpec } from "./builder/selection-table";
import { stripSlug } from "../pc.resolver";

// Honest ledger columns for the race picker — size/speed exist in the entity
// data today. Sorted by rank order (not alphabetically) and walking speed.
const SIZE_ORDER = ["tiny", "small", "medium", "large", "huge"];
const sizeOf = (e: RegisteredEntity): string => String((e.data as { size?: string }).size ?? "");
const walkOf = (e: RegisteredEntity): number =>
  Number((e.data as { speed?: { walk?: number } }).speed?.walk ?? 0);
const RACE_COLUMNS: ColSpec[] = [
  {
    label: "Size", cls: "col-size", width: "90px",
    sort: (a, b) => SIZE_ORDER.indexOf(sizeOf(a)) - SIZE_ORDER.indexOf(sizeOf(b)),
    render: (cell, e) => {
      const s = sizeOf(e);
      cell.setText(s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
    },
  },
  {
    label: "Speed", cls: "col-speed", width: "90px",
    sort: (a, b) => walkOf(a) - walkOf(b),
    render: (cell, e) => {
      const w = walkOf(e);
      cell.setText(w ? `${w} ft.` : "—");
    },
  },
];

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
      // Reference consumer (Plan 2): basic race selection only. Subrace +
      // racial decision callouts arrive with the full step in Plan 4.
      renderEntityPicker(body, ctx, {
        entityType: "race",
        stateKey: "builder.race-picker",
        selectedSlug: stripSlug(ctx.resolved.definition.race),
        onSelect: (slug) => ctx.editState?.setRace(slug),
        columns: RACE_COLUMNS,
      });
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
      const next = foot.createEl("button", { cls: "pc-builder-next mod-cta", text: "Next ▸" });
      next.addEventListener("click", () => this.goTo(BUILDER_STEPS[idx + 1].id, el, ctx));
    } else {
      foot.createEl("button", { cls: "pc-builder-finish mod-cta", text: "✓ Finish & open sheet" });
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
