import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { formatModifier } from "../../../shared/dnd/math";
import type { Ability } from "../../../shared/types";
import { numberOverride } from "./edit-primitives";

/**
 * V7 ability row: six ability cards in a grid. Each card has an obelisk
 * cartouche (label / modifier / score pill) with a save chip stacked below.
 * Clicking the score pill opens an inline input that writes to
 * `overrides.scores[ability]`; `*` appears on overridden scores.
 */
export class AbilityRow implements SheetComponent {
  readonly type = "ability-row";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const grid = el.createDiv({ cls: "pc-ability-row" });
    const editState = ctx.editState;
    const overrides = ctx.resolved.definition?.overrides;
    for (const ab of ABILITY_KEYS as readonly Ability[]) {
      const stack = grid.createDiv({ cls: "pc-ab-stack" });

      const card = stack.createDiv({ cls: "pc-ab", attr: { "data-ability": ab } });
      card.createDiv({ cls: "pc-ab-label", text: (ABILITY_NAMES[ab] ?? ab).slice(0, 3) });
      card.createDiv({ cls: "pc-ab-mod", text: formatModifier(ctx.derived.mods[ab]) });
      const scoreEl = card.createDiv({ cls: "pc-ab-score", text: String(ctx.derived.scores[ab]) });

      if (editState) {
        numberOverride(scoreEl, {
          getEffective: () => ctx.derived.scores[ab],
          isOverridden: () => overrides?.scores?.[ab] !== undefined,
          onSet: (n) => editState.setScoreOverride(ab, n),
          onClear: () => editState.clearScoreOverride(ab),
          min: 1,
          max: 30,
        });
      }

      const chipType = `save-chip-${ab}`;
      const chip = this.registry.get(chipType);
      if (!chip) {
        stack.createDiv({ cls: "pc-empty-line", text: `(No renderer for ${chipType})` });
        continue;
      }
      chip.render(stack, ctx);
    }
  }
}
