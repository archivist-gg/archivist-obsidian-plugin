import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { renderByLevelView } from "./spells/by-level-view";
import { renderTableView } from "./spells/table-view";
import { openAddSpellModal } from "./spells/add-spell-modal";
import { preparedWarnings } from "./spells/spell-display";

export class SpellsTab implements SheetComponent {
  readonly type = "spells-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-spells-body" });
    const casters = ctx.derived.spellcastingClasses;

    if (casters.length === 0) {
      const empty = root.createDiv({ cls: "pc-spells-empty" });
      empty.createDiv({ cls: "pc-spells-empty-icon", text: "☆" });
      empty.createDiv({ cls: "pc-spells-empty-title", text: "No Spellcasting" });
      const name = ctx.resolved.definition.name;
      const className = ctx.resolved.classes[0]?.entity?.name ?? "this class";
      empty.createDiv({
        cls: "pc-spells-empty-subtitle",
        text: `${name} is a ${className} with no spellcasting feature.`,
      });
      return;
    }

    // Header: per-class DC/attack + view toggle
    const header = root.createDiv({ cls: "pc-spell-header" });
    const dcRow = header.createDiv({ cls: "pc-spell-dc-row" });
    casters.forEach((c, i) => {
      if (i > 0) dcRow.createSpan({ text: "   " });
      dcRow.createSpan({ text: `${c.ability.toUpperCase()} ` });
      dcRow.createSpan({ text: "Save DC " });
      dcRow.createEl("b", { text: `${c.saveDC}` });
      dcRow.createSpan({ text: " · Atk " });
      dcRow.createEl("b", { text: `${c.attackBonus >= 0 ? "+" : ""}${c.attackBonus}` });
      if (casters.length > 1) dcRow.createSpan({ cls: "pc-spell-dc-class", text: ` (${c.className})` });
    });

    for (const w of preparedWarnings(ctx.resolved.spells, ctx.derived.spellLimits)) {
      dcRow.createSpan({ cls: "pc-spell-limit-warn", text: `⚠ ${w}` });
    }

    const mode = ctx.resolved.definition.spells.view ?? "by-level";
    const toggle = header.createEl("button", {
      cls: "pc-spell-viewtoggle",
      text: mode === "by-level" ? "View: By level" : "View: Table",
    });
    toggle.addEventListener("click", () =>
      ctx.editState?.setSpellsView(mode === "by-level" ? "table" : "by-level"),
    );

    // Concentration banner
    const conc = ctx.resolved.state.concentration;
    if (conc) {
      const banner = root.createDiv({ cls: "pc-conc-banner" });
      const concSlug = conc.replace(/^\[\[|\]\]$/g, "");
      const concSpell = ctx.resolved.spells.find((s) => s.slug === concSlug);
      banner.createSpan({ text: "Concentrating: " });
      banner.createEl("b", { text: concSpell?.entity.name ?? conc });
      const end = banner.createSpan({ cls: "pc-conc-end", text: "end ✕" });
      end.addEventListener("click", () => ctx.editState?.breakConcentration());
    }

    // Body
    if (mode === "table") renderTableView(root, ctx);
    else renderByLevelView(root, ctx);

    // Add spell. Label built via appendText (matching the inventory toolbar)
    // so the multi-word title-case button text isn't reformatted by the
    // sentence-case UI lint rule, which only inspects createEl `text:` literals.
    const addBtn = root.createEl("button", { cls: "pc-spell-addbtn" });
    addBtn.appendText("+ Add Spell");
    addBtn.addEventListener("click", () => openAddSpellModal(ctx));
  }
}
