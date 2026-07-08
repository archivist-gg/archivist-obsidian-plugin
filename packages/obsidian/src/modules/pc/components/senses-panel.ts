import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { PassiveKind } from "@archivist/dnd5e/pc/pc.types";
import type { SenseType } from "@archivist/dnd5e/types/feature-effect";
import { numberOverride } from "./edit-primitives";

const PASSIVE_ROWS: ReadonlyArray<[label: string, kind: PassiveKind]> = [
  ["Perception", "perception"],
  ["Investigation", "investigation"],
  ["Insight", "insight"],
];

const SENSE_ROWS: ReadonlyArray<[label: string, key: SenseType]> = [
  ["Darkvision", "darkvision"],
  ["Blindsight", "blindsight"],
  ["Tremorsense", "tremorsense"],
  ["Truesight", "truesight"],
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

    // Senses (computed: race vision ∨ feature effects). Optional-chained
    // because tests cast partial DerivedStats objects.
    for (const [label, key] of SENSE_ROWS) {
      const dist = ctx.derived.senses?.[key] ?? 0;
      if (dist > 0) {
        const row = list.createDiv({ cls: "pc-sense-row" });
        row.createSpan({ cls: "pc-sense-name", text: label });
        row.createSpan({ cls: "pc-sense-dist", text: `${dist} ft.` });
      }
    }
  }
}
