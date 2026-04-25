import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { PassiveKind } from "../pc.types";
import { numberOverride } from "./edit-primitives";

const PASSIVE_ROWS: ReadonlyArray<[label: string, kind: PassiveKind]> = [
  ["Perception", "perception"],
  ["Investigation", "investigation"],
  ["Insight", "insight"],
];

export class SensesPanel implements SheetComponent {
  readonly type = "senses-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const section = el.createDiv({ cls: "pc-sidebar-section" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Passive Senses" });
    const list = section.createDiv({ cls: "pc-senses-list" });

    for (const [label, kind] of PASSIVE_ROWS) {
      const row = list.createDiv({ cls: "pc-sense-row" });
      row.createSpan({ cls: "pc-sense-name", text: label });
      const valEl = row.createSpan({ cls: "pc-sense-val", text: `${ctx.derived.passives[kind]}` });
      if (ctx.editState) {
        numberOverride(valEl, {
          getEffective: () => ctx.derived.passives[kind],
          isOverridden: () => ctx.resolved.definition?.overrides?.passives?.[kind] !== undefined,
          onSet: (n) => ctx.editState!.setPassiveOverride(kind, n),
          onClear: () => ctx.editState!.clearPassiveOverride(kind),
          min: 0, max: 40,
        });
      }
    }
  }
}
