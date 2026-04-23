import type { SheetComponent, ComponentRenderContext } from "./component.types";

export class SensesPanel implements SheetComponent {
  readonly type = "senses-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const section = el.createDiv({ cls: "pc-sidebar-section" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Passive Senses" });
    const list = section.createDiv({ cls: "pc-senses-list" });
    for (const [label, value] of [
      ["Perception", ctx.derived.passives.perception],
      ["Investigation", ctx.derived.passives.investigation],
      ["Insight", ctx.derived.passives.insight],
    ] as const) {
      const row = list.createDiv({ cls: "pc-sense-row" });
      row.createSpan({ cls: "pc-sense-name", text: label });
      row.createSpan({ cls: "pc-sense-val", text: `${value}` });
    }
  }
}
