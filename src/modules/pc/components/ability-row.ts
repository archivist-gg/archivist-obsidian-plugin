import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { formatModifier } from "../../../shared/dnd/math";
import type { Ability } from "../../../shared/types";

export class AbilityRow implements SheetComponent {
  readonly type = "ability-row";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const row = el.createDiv({ cls: "pc-ability-row" });
    for (const ab of ABILITY_KEYS as readonly Ability[]) {
      const card = row.createDiv({ cls: "pc-ability-card", attr: { "data-ability": ab } });
      card.createDiv({ cls: "pc-ability-label", text: (ABILITY_NAMES[ab] ?? ab).toUpperCase() });
      card.createDiv({ cls: "pc-ability-mod", text: formatModifier(ctx.derived.mods[ab]) });
      card.createDiv({ cls: "pc-ability-score", text: String(ctx.derived.scores[ab]) });
    }
  }
}
