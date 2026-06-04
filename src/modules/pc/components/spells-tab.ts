import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { renderCastView } from "./spells/cast-view";
import { renderPrepareView } from "./spells/prepare-view";

type SpellsMode = "cast" | "prepare";

export class SpellsTab implements SheetComponent {
  readonly type = "spells-tab";
  private mode: SpellsMode = "cast";
  private modeForCharacter: string | null = null;

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    el.empty();
    const root = el.createDiv({ cls: "pc-tab-body pc-spells-body" });
    const casters = ctx.derived.spellcastingClasses;

    if (casters.length === 0) {
      const empty = root.createDiv({ cls: "pc-spells-empty" });
      empty.createDiv({ cls: "pc-spells-empty-icon", text: "☆" });
      empty.createDiv({ cls: "pc-spells-empty-title", text: "No Spellcasting" });
      const name = ctx.resolved.definition.name;
      const className = ctx.resolved.classes[0]?.entity?.name ?? "this class";
      empty.createDiv({ cls: "pc-spells-empty-subtitle", text: `${name} is a ${className} with no spellcasting feature.` });
      return;
    }

    // Ephemeral mode: reset to Cast when a different character is shown.
    const charId = ctx.resolved.definition.name;
    if (this.modeForCharacter !== charId) { this.mode = "cast"; this.modeForCharacter = charId; }

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

    // Cast / Prepare(Manage) segmented toggle.
    const secondLabel = casters.some((c) => c.preparation === "prepared") ? "Prepare" : "Manage";
    const seg = header.createDiv({ cls: "pc-spell-modetoggle" });
    const castSeg = seg.createEl("button", { cls: `pc-mode-seg${this.mode === "cast" ? " active" : ""}`, text: "Cast" });
    const prepSeg = seg.createEl("button", { cls: `pc-mode-seg${this.mode === "prepare" ? " active" : ""}`, text: secondLabel });
    castSeg.addEventListener("click", () => { this.mode = "cast"; this.render(el, ctx); });
    prepSeg.addEventListener("click", () => { this.mode = "prepare"; this.render(el, ctx); });

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

    if (this.mode === "cast") renderCastView(root, ctx);
    else renderPrepareView(root, ctx);
  }
}
