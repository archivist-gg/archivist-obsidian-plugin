import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";
import { collectBandRows } from "./resources/resource-model";
import { renderResourceControl } from "./resources/resource-controls";

/**
 * The header resource band — ONE `.pc-panel` in the hero cluster, its cells
 * divided by hairlines, holding the handful of resources a player touches
 * constantly: hit dice always, plus every resource whose own note says
 * `surface: band`.
 *
 * It shows **current and total and nothing else**. No "/ Long Rest", no recovery
 * caption, no reset wording of any kind: someone glancing at the header is
 * asking how many are left, and the answer to "when does it come back?" is one
 * tab away, under a heading that says exactly that.
 *
 * A component dropped into a cell SHEDS ITS OWN CHROME — `styles/resources.css`
 * strips the border, background, shadow, padding and min-width off a `.pc-panel`
 * or `.pc-hd-widget` inside `.pc-rband`, because the band is the panel. That is
 * how hit dice arrive as the SHIPPED `HitDiceWidget`, looked up through the
 * registry and rendered unchanged, keeping the multiclass chip row that nothing
 * else on the sheet can draw. It is the only hit-dice widget in the hero:
 * `HeaderSection` no longer mounts a standalone one beside it.
 *
 * The hit-dice cell is UNCONDITIONAL (rider N-3-18). Hit dice are not an
 * optional resource — every class grants them — so a character without any is
 * one mid-creation, and the widget's own "—" empty state is the line that says
 * so. Gating the cell on `hasHitDice` silently removed the box from a class-less
 * builder draft, which had shown "—" before the standalone widget was folded in
 * here; that empty state is the whole point of having one. The band therefore
 * always draws, and `collectBandRows` only decides what sits BESIDE the dice.
 */
export class ResourceBand implements SheetComponent {
  readonly type = "resource-band";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const rows = collectBandRows(ctx);

    const band = el.createDiv({ cls: "pc-panel pc-rband" });

    {
      const cell = band.createDiv({ cls: "pc-rband-cell" });
      const hd = this.registry.get("hit-dice-widget");
      // Looked up, never `new`ed: a registry without it degrades to the same
      // "(No renderer …)" line every other missing widget shows.
      if (hd) hd.render(cell, ctx);
      else cell.createDiv({ cls: "pc-empty-line", text: "(No renderer for hit-dice-widget)" });
    }

    for (const row of rows) {
      renderResourceControl(band.createDiv({ cls: "pc-rband-cell" }), row, ctx, "band");
    }
  }
}
