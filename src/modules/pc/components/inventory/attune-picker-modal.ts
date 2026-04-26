import { Modal, setIcon, type App } from "obsidian";
import type { VisibleEntry } from "./filter-state";
import { iconForEntity } from "./icon-mapping";

export interface AttunePickerOptions {
  slotIndex: number;
  candidates: VisibleEntry[];
  onPick: (entryIndex: number) => void;
}

export class AttunePickerModal extends Modal {
  constructor(app: App, private readonly opts: AttunePickerOptions) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("archivist-modal", "pc-attune-picker");
    this.contentEl.createEl("h2", { text: "Attune which item?" });

    if (this.opts.candidates.length === 0) {
      this.contentEl.createEl("p", { cls: "pc-attune-picker-empty",
        text: "No carried items currently require attunement. Pick up a magic item from the compendium to attune." });
      const actions = this.contentEl.createDiv({ cls: "archivist-modal-buttons" });
      actions.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
      return;
    }

    this.contentEl.createEl("p", {
      text: `Your inventory has ${this.opts.candidates.length} item${this.opts.candidates.length === 1 ? "" : "s"} requiring attunement. Pick one to fill slot ${this.opts.slotIndex + 1}.`,
    });

    const list = this.contentEl.createDiv({ cls: "pc-attune-picker-list" });
    for (const cand of this.opts.candidates) {
      const row = list.createDiv({ cls: "pc-attune-picker-row" });
      const ic = row.createSpan({ cls: "pc-attune-picker-icon" });
      setIcon(ic, iconForEntity(cand.resolved, cand.entry));
      const e = cand.resolved.entity as { name?: string; type?: string; rarity?: string } | null;
      const text = row.createDiv({ cls: "pc-attune-picker-text" });
      text.createDiv({ cls: "pc-attune-picker-name", text: e?.name ?? cand.entry.item });
      const sub: string[] = [];
      if (e?.type) sub.push(e.type);
      if (e?.rarity) sub.push(e.rarity);
      sub.push("requires attunement");
      text.createDiv({ cls: "pc-attune-picker-sub", text: sub.join(" · ") });
      const pickBtn = row.createEl("button", { cls: "pc-attune-picker-pick", text: "Pick" });
      pickBtn.addEventListener("click", () => {
        this.opts.onPick(cand.resolved.index);
        this.close();
      });
    }

    const actions = this.contentEl.createDiv({ cls: "archivist-modal-buttons" });
    actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}
