import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { aggregateProficiencies } from "@archivist-gg/dnd5e/pc/pc.proficiencies";

export class ProficienciesPanel implements SheetComponent {
  readonly type = "proficiencies-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const section = el.createDiv({ cls: "pc-sidebar-section pc-proficiencies" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Proficiencies" });
    const body = section.createDiv({ cls: "pc-prof-body" });
    const agg = aggregateProficiencies(ctx.resolved);

    const labelFor = (label: string, items: string[]) => {
      const p = body.createDiv({ cls: "pc-prof-line" });
      p.createSpan({ cls: "pc-prof-key", text: `${label}: ` });
      p.createSpan({ cls: "pc-prof-vals", text: items.length ? items.join(", ") : "—" });
    };
    labelFor("Armor", agg.armor);
    labelFor("Weapons", agg.weapons);
    labelFor("Tools", agg.tools);
    labelFor("Languages", agg.languages);
  }
}
