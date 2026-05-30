import { Modal } from "obsidian";
import type { ComponentRenderContext } from "../component.types";
import { classSpellCandidates } from "./spell-access";
import { CharacterEditState } from "../../pc.edit-state";

class AddSpellModal extends Modal {
  private showAll = false;
  private query = "";
  constructor(private readonly ctx: ComponentRenderContext) {
    super(ctx.app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("archivist-modal", "pc-add-spell");
    this.contentEl.createEl("h2", { text: "Add spell" });

    const controls = this.contentEl.createDiv({ cls: "pc-spell-filters" });
    const list = this.contentEl.createDiv({ cls: "pc-add-spell-list" });

    const search = controls.createEl("input", { attr: { type: "text", placeholder: "Search…" } });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderList(list);
    });

    const allToggle = controls.createEl("button", { cls: "pc-spell-filter", text: "Show all classes" });
    allToggle.addEventListener("click", () => {
      this.showAll = !this.showAll;
      allToggle.classList.toggle("active", this.showAll);
      this.renderList(list);
    });

    this.renderList(list);
  }

  private renderList(list: HTMLElement): void {
    list.empty();
    const ctx = this.ctx;
    const classSlugs = ctx.derived.spellcastingClasses.map((c) => c.classSlug);
    const maxLevel = Math.max(
      0,
      ...Object.keys(ctx.derived.derivedSpellSlots).map(Number),
      ctx.derived.pactMagic?.level ?? 0,
    );
    const known = new Set(ctx.resolved.spells.map((s) => s.slug));
    const candidates = classSpellCandidates(ctx.core.entities, classSlugs, maxLevel, known, this.showAll, this.query);

    if (candidates.length === 0) {
      list.createEl("p", { cls: "pc-spell-pick-meta", text: "No matching spells." });
      return;
    }

    for (const c of candidates.slice(0, 200)) {
      const row = list.createDiv({ cls: "pc-spell-pick-row" });
      row.createSpan({ cls: "pc-spell-pick-name", text: c.name });
      row.createSpan({ cls: "pc-spell-pick-meta", text: c.level === 0 ? "cantrip" : `lvl ${c.level}` });
      const pick = row.createEl("button", { cls: "pc-spell-filter", text: "Add" });
      pick.addEventListener("click", () => {
        if (this.ctx.editState instanceof CharacterEditState) this.ctx.editState.addKnownSpell(c.slug);
        this.close();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function openAddSpellModal(ctx: ComponentRenderContext): void {
  new AddSpellModal(ctx).open();
}
