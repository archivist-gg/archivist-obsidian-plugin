import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { aggregateProficiencies } from "@archivist-gg/dnd5e/pc/pc.proficiencies";
import type { ProficiencyEntry } from "@archivist-gg/dnd5e/pc/pc.proficiencies";
import {
  openProficiencyModal,
  refreshProficiencyModal,
  type ProficiencyDomain,
} from "./proficiency-edit-modal";

export class ProficienciesPanel implements SheetComponent {
  readonly type = "proficiencies-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // Repaint/tear down an open proficiency modal on every sheet pass, before
    // anything is drawn. Unconditional on purpose (hp-widget.ts:24 and
    // spells-tab.ts:22 do the same; currency-strip.ts:29 guards):
    // refreshProficiencyModal already no-ops when no modal is open, and the
    // guard would duplicate that check plugin-side. It is also what re-runs the
    // modal's updateDynamic after a chip/row click, so the modal's per-repaint
    // candidate snapshot cannot go stale.
    refreshProficiencyModal(ctx);
    const section = el.createDiv({ cls: "pc-sidebar-section pc-proficiencies" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Proficiencies" });
    const body = section.createDiv({ cls: "pc-prof-body" });
    const agg = aggregateProficiencies(ctx.resolved);

    /** One row. The sheet states only what is TRUE: no "choose N" placeholder
     *  lives here any more · unspent picks are the BUILDER's subject, and a
     *  character with no fixed languages and unspent picks reads
     *  "Languages: None" by design (spec R4-P3b §9).
     *
     *  `domain` is passed for the two user-editable buckets only. Armor and
     *  weapons pass none and stay inert: no class, no attribute, no handler. */
    const labelFor = (label: string, entries: ProficiencyEntry[], domain?: ProficiencyDomain) => {
      const p = body.createDiv({ cls: "pc-prof-line" });
      if (domain && ctx.editState) {
        p.addClass("editable");
        p.setAttribute("data-prof-domain", domain);
        p.addEventListener("click", () => openProficiencyModal(ctx, domain));
      }
      p.createSpan({ cls: "pc-prof-key", text: `${label}: ` });
      p.createSpan({
        cls: "pc-prof-vals",
        text: entries.length ? entries.map((e) => e.label).join(", ") : "None",
      });
    };
    labelFor("Armor", agg.armor);
    labelFor("Weapons", agg.weapons);
    labelFor("Tools", agg.tools, "tools");
    labelFor("Languages", agg.languages, "languages");
  }
}
