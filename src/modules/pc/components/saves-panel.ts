import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { formatModifier } from "../../../shared/dnd/math";
import type { Ability } from "../../../shared/types";

export class SavesPanel implements SheetComponent {
  readonly type = "saves-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const section = el.createDiv({ cls: "pc-sidebar-section" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Saving Throws" });
    const list = section.createDiv({ cls: "pc-saves-list" });
    for (const ab of ABILITY_KEYS as readonly Ability[]) {
      const save = ctx.derived.saves[ab];
      const row = list.createDiv({ cls: "pc-save-row" });
      row.createSpan({ cls: `pc-prof-dot${save.proficient ? " filled" : ""}` });
      row.createSpan({ cls: "pc-save-bonus", text: formatModifier(save.bonus) });
      row.createSpan({ cls: "pc-save-name", text: (ABILITY_NAMES[ab] ?? ab).slice(0, 3).toUpperCase() });
    }
  }
}
