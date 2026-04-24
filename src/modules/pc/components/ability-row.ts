import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { formatModifier } from "../../../shared/dnd/math";
import type { Ability } from "../../../shared/types";

/**
 * V7 ability row: six ability cards in a grid. Each card has an obelisk
 * cartouche (label / modifier / score pill) with a save chip stacked below.
 * Save chip is now a registered component (one per ability) — we look it up
 * by type `save-chip-{ab}` and delegate rendering.
 */
export class AbilityRow implements SheetComponent {
  readonly type = "ability-row";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const grid = el.createDiv({ cls: "pc-ability-row" });
    for (const ab of ABILITY_KEYS as readonly Ability[]) {
      const stack = grid.createDiv({ cls: "pc-ab-stack" });

      const card = stack.createDiv({ cls: "pc-ab", attr: { "data-ability": ab } });
      card.createDiv({ cls: "pc-ab-label", text: (ABILITY_NAMES[ab] ?? ab).slice(0, 3) });
      card.createDiv({ cls: "pc-ab-mod", text: formatModifier(ctx.derived.mods[ab]) });
      card.createDiv({ cls: "pc-ab-score", text: String(ctx.derived.scores[ab]) });

      const chip = this.registry.get(`save-chip-${ab}`);
      chip?.render(stack, ctx);
    }
  }
}
