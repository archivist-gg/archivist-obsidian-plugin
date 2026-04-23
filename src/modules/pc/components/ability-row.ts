import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { formatModifier } from "../../../shared/dnd/math";
import type { Ability } from "../../../shared/types";
import { renderSaveChip } from "./save-chip";

/**
 * V7 ability row: six ability cards in a grid, free-floating — no outer container.
 * The obelisk cartouche outline comes from a CSS data-URI background on `.pc-ab`
 * (see components.css). Each card: label / modifier / score pill (positioned absolute
 * hanging off the bottom edge). A save chip sits below each card in a stack.
 */
export class AbilityRow implements SheetComponent {
  readonly type = "ability-row";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const grid = el.createDiv({ cls: "pc-ability-row" });
    for (const ab of ABILITY_KEYS as readonly Ability[]) {
      const stack = grid.createDiv({ cls: "pc-ab-stack" });

      const card = stack.createDiv({ cls: "pc-ab", attr: { "data-ability": ab } });
      card.createDiv({ cls: "pc-ab-label", text: (ABILITY_NAMES[ab] ?? ab).slice(0, 3) });
      card.createDiv({ cls: "pc-ab-mod", text: formatModifier(ctx.derived.mods[ab]) });
      card.createDiv({ cls: "pc-ab-score", text: String(ctx.derived.scores[ab]) });

      const save = ctx.derived.saves[ab];
      renderSaveChip(stack, { bonus: save.bonus, proficient: save.proficient });
    }
  }
}
