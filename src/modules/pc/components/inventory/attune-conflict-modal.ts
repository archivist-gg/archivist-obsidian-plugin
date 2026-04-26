import { Modal, type App } from "obsidian";
import type { ResolvedEquipped } from "../../pc.types";
import { iconForEntity } from "./icon-mapping";
import { setInventoryIcon } from "../../assets/inventory-icons";

export interface AttuneConflictOptions {
  slots: ResolvedEquipped[];      // currently-attuned, in slot order
  incoming: ResolvedEquipped;     // the item the user is trying to attune
  onSwap: (slotIndex: number) => void;  // slot's equipment[].index, NOT slot ordinal
}

export class AttuneConflictModal extends Modal {
  constructor(app: App, private readonly opts: AttuneConflictOptions) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("archivist-modal", "pc-attune-conflict");
    this.contentEl.createEl("h2", { text: "Attunement limit reached" });
    const incName = (this.opts.incoming.entity as { name?: string } | null)?.name ?? this.opts.incoming.entry.item;
    const para = this.contentEl.createEl("p");
    para.setText(`You can only attune ${this.opts.slots.length} items. Pick a slot to replace with `);
    para.createEl("b", { text: incName });
    para.appendText(", or cancel.");

    const swapRow = this.contentEl.createDiv({ cls: "pc-attune-conflict-row" });
    for (const slot of this.opts.slots) {
      const cell = renderConflictCell(swapRow, slot, false);
      cell.addEventListener("click", () => {
        this.opts.onSwap(slot.index);
        this.close();
      });
    }
    swapRow.createDiv({ cls: "pc-attune-conflict-arrow", text: "→" });
    renderConflictCell(swapRow, this.opts.incoming, true);

    const actions = this.contentEl.createDiv({ cls: "archivist-modal-buttons" });
    const cancel = actions.createEl("button", { cls: "pc-attune-conflict-cancel", text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}

function renderConflictCell(parent: HTMLElement, occupant: ResolvedEquipped, incoming: boolean): HTMLElement {
  const cls = incoming ? "pc-attune-conflict-cell incoming" : "pc-attune-conflict-cell";
  const cell = parent.createDiv({ cls });
  const e = occupant.entity as { name?: string } | null;
  cell.createDiv({ cls: "pc-attune-conflict-role", text: incoming ? "Incoming" : "Slot" });
  const med = cell.createDiv({ cls: "pc-medallion" });
  const ic = med.createSpan({ cls: "pc-medallion-icon" });
  setInventoryIcon(ic, iconForEntity(occupant, occupant.entry));
  cell.createDiv({ cls: "pc-attune-conflict-name", text: e?.name ?? occupant.entry.item });
  return cell;
}
