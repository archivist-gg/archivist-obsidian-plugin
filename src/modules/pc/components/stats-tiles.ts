import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { formatModifier } from "../../../shared/dnd/math";

/**
 * Right side of the stats band: four bordered tiles in a 2×2 grid.
 * PB · INIT · SPEED · INSPIRATION. Only the Inspiration tile has interactive
 * scaffold (− / count / +). SP4 wires the handlers.
 */
export class StatsTiles implements SheetComponent {
  readonly type = "stats-tiles";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const grid = el.createDiv({ cls: "pc-stats-tiles" });

    this.tile(grid, "prof", "PROFICIENCY", formatModifier(ctx.derived.proficiencyBonus));
    this.tile(grid, "init", "INITIATIVE", formatModifier(ctx.derived.initiative));
    this.tile(grid, "speed", "SPEED", `${ctx.derived.speed}ft`);

    const insp = grid.createDiv({ cls: "pc-panel pc-stats-tile", attr: { "data-stat": "insp" } });
    insp.createDiv({ cls: "pc-stats-tile-lbl", text: "INSPIRATION" });
    const counter = insp.createDiv({ cls: "pc-insp-counter" });
    counter.createEl("button", { cls: "pc-insp-minus", text: "−", attr: { title: "Decrease inspiration" } });
    counter.createSpan({ cls: "pc-stats-tile-ct", text: String(ctx.resolved?.state?.inspiration ?? 0) });
    counter.createEl("button", { cls: "pc-insp-plus", text: "+", attr: { title: "Increase inspiration" } });
  }

  private tile(parent: HTMLElement, stat: string, label: string, value: string) {
    const t = parent.createDiv({ cls: "pc-panel pc-stats-tile", attr: { "data-stat": stat } });
    t.createDiv({ cls: "pc-stats-tile-lbl", text: label });
    t.createDiv({ cls: "pc-stats-tile-val", text: value });
  }
}
