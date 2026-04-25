import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { formatModifier } from "../../../shared/dnd/math";
import { numberOverride } from "./edit-primitives";

/**
 * Right side of the stats band: four bordered tiles in a 2×2 grid.
 * PB · INIT · SPEED · INSPIRATION. Inspiration uses − / count / +;
 * INIT and SPEED support click-to-edit overrides via numberOverride.
 */
export class StatsTiles implements SheetComponent {
  readonly type = "stats-tiles";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const grid = el.createDiv({ cls: "pc-stats-tiles" });

    // PB — read-only, simple
    this.tile(grid, "prof", "PROFICIENCY", formatModifier(ctx.derived.proficiencyBonus));

    // INIT — click-to-edit when editState present
    const initTile = grid.createDiv({ cls: "pc-panel pc-stats-tile", attr: { "data-stat": "init" } });
    initTile.createDiv({ cls: "pc-stats-tile-lbl", text: "INITIATIVE" });
    const initVal = initTile.createDiv({ cls: "pc-stats-tile-val", text: formatModifier(ctx.derived.initiative) });
    if (ctx.editState) {
      numberOverride(initVal, {
        getEffective: () => ctx.derived.initiative,
        isOverridden: () => ctx.resolved.definition?.overrides?.initiative !== undefined,
        onSet: (n) => ctx.editState!.setInitiativeOverride(n),
        onClear: () => ctx.editState!.clearInitiativeOverride(),
        min: -20, max: 30,
      });
    }

    // SPEED — number + unit split inside .pc-stats-tile-val so the existing
    // `.pc-stats-tile-val.textContent === "30ft"` test still passes via
    // concatenated child text, but numberOverride targets just the integer.
    const speedTile = grid.createDiv({ cls: "pc-panel pc-stats-tile", attr: { "data-stat": "speed" } });
    speedTile.createDiv({ cls: "pc-stats-tile-lbl", text: "SPEED" });
    const speedVal = speedTile.createDiv({ cls: "pc-stats-tile-val" });
    const speedNum = speedVal.createSpan({ cls: "pc-stats-tile-num", text: String(ctx.derived.speed) });
    speedVal.createSpan({ cls: "pc-stats-tile-unit", text: "ft" });
    if (ctx.editState) {
      numberOverride(speedNum, {
        getEffective: () => ctx.derived.speed,
        isOverridden: () => ctx.resolved.definition?.overrides?.speed !== undefined,
        onSet: (n) => ctx.editState!.setSpeedOverride(n),
        onClear: () => ctx.editState!.clearSpeedOverride(),
        min: 0, max: 240,
      });
    }

    // INSPIRATION — unchanged from SP4
    const insp = grid.createDiv({ cls: "pc-panel pc-stats-tile", attr: { "data-stat": "insp" } });
    insp.createDiv({ cls: "pc-stats-tile-lbl", text: "INSPIRATION" });
    const counter = insp.createDiv({ cls: "pc-insp-counter" });
    const current = ctx.resolved?.state?.inspiration ?? 0;
    const minusBtn = counter.createEl("button", { cls: "pc-insp-minus", text: "−", attr: { title: "Decrease inspiration" } });
    counter.createSpan({ cls: "pc-stats-tile-ct", text: String(current) });
    const plusBtn = counter.createEl("button", { cls: "pc-insp-plus", text: "+", attr: { title: "Increase inspiration" } });

    if (ctx.editState) {
      minusBtn.addEventListener("click", () => ctx.editState!.setInspiration(current - 1));
      plusBtn.addEventListener("click", () => ctx.editState!.setInspiration(current + 1));
    }
  }

  private tile(parent: HTMLElement, stat: string, label: string, value: string) {
    const t = parent.createDiv({ cls: "pc-panel pc-stats-tile", attr: { "data-stat": stat } });
    t.createDiv({ cls: "pc-stats-tile-lbl", text: label });
    t.createDiv({ cls: "pc-stats-tile-val", text: value });
  }
}
