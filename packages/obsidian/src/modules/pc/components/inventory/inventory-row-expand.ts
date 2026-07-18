import { Notice, type App } from "obsidian";
import type { AttackRow, EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import { renderItemBlock } from "../../../item/item.renderer";
import { renderWeaponBlock } from "../../../weapon/weapon.renderer";
import { renderArmorBlock } from "../../../armor/armor.renderer";
import type { WeaponEntity } from "@archivist-gg/dnd5e/weapon/weapon.types";
import type { ArmorEntity } from "@archivist-gg/dnd5e/armor/armor.types";
import type { Item } from "@archivist-gg/dnd5e/item/item.types";
import type { EntityRegistry } from "@archivist-gg/core";
import { requiresAttunement } from "@archivist-gg/dnd5e/item/item.attunement";
import { unequipWithAttunementCheck } from "./unequip-flow";
import { renderOverrideActionsPanel } from "./override-actions-panel";

export interface RowExpandCtx {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
  app: App;
  editState: CharacterEditState | null;
  /** Optional registry handle. Reserved for future expand-time entity lookups;
   *  currently unused by the renderer itself but accepted for API stability. */
  registry?: EntityRegistry | null;
  /** 2024 weapon mastery for this attack, threaded ONLY by the Actions-tab
   *  weapons table so the weapon card shows an in-card mastery section. The
   *  Inventory-tab + compendium call sites pass none → card renders unchanged. */
  mastery?: AttackRow["mastery"];
  onAttuneConflict?: (incomingIndex: number) => void;
}

export function renderRowExpand(parent: HTMLElement, ctx: RowExpandCtx): HTMLElement {
  const expand = parent.createDiv({ cls: "pc-inv-expand" });

  if (!ctx.resolved.entity) {
    const orphan = expand.createDiv({ cls: "pc-inv-orphan" });
    orphan.createSpan({ cls: "pc-inv-orphan-icon", text: "⚠" });
    orphan.createSpan({
      cls: "pc-inv-orphan-msg",
      text: `No compendium entry for "${ctx.entry.item}". Link it as [[slug]] in YAML or remove the row.`,
    });
  } else if (ctx.resolved.entityType === "weapon") {
    expand.appendChild(renderWeaponBlock(ctx.resolved.entity as WeaponEntity, ctx.mastery));
  } else if (ctx.resolved.entityType === "armor") {
    expand.appendChild(renderArmorBlock(ctx.resolved.entity as ArmorEntity));
  } else {
    const item = ctx.resolved.entity as Item;
    // Async item renderer (markdown description); use a stable wrapper so the
    // returned `expand` reference stays valid for callers.
    const itemWrapper = expand.createDiv();
    void renderItemBlock(item, ctx.app).then((block) => {
      itemWrapper.appendChild(block);
    });
  }

  // PC-actions strip — sits below the block, separate concern.
  if (ctx.editState) renderActionsStrip(expand, ctx, ctx.editState);

  // Action overrides panel — collapsible, edit-mode only.
  if (ctx.editState) {
    const details = expand.createEl("details", { cls: "pc-override-actions-details" });
    details.createEl("summary", { text: "Action overrides" });
    renderOverrideActionsPanel(details, {
      entry: ctx.entry,
      entryIndex: ctx.resolved.index,
      editState: ctx.editState,
    });
  }
  return expand;
}

function renderActionsStrip(parent: HTMLElement, ctx: RowExpandCtx, editState: CharacterEditState): void {
  const strip = parent.createDiv({ cls: "pc-inv-actions" });
  const i = ctx.resolved.index;

  // Equip / Unequip
  const equipBtn = strip.createEl("button", { cls: "pc-inv-action", text: ctx.entry.equipped ? "Unequip" : "Equip" });
  if (ctx.entry.equipped) equipBtn.classList.add("active");
  equipBtn.addEventListener("click", () => {
    if (ctx.entry.equipped) {
      void unequipWithAttunementCheck(ctx.app, editState, ctx.entry, i);
    } else {
      const res = editState.equipItemWithSwap(i);
      if (res.unequipped?.length) new Notice(`Unequipped ${res.unequipped.join(", ")} (slot occupied).`);
    }
  });

  // Attune / Unattune — only when required
  if (requiresAttunement(ctx.resolved.entity)) {
    const attuneBtn = strip.createEl("button", { cls: "pc-inv-action", text: ctx.entry.attuned ? "Unattune" : "Attune" });
    if (ctx.entry.attuned) attuneBtn.classList.add("active");
    attuneBtn.addEventListener("click", () => {
      if (ctx.entry.attuned) {
        editState.unattuneItem(i);
        return;
      }
      const result = editState.attuneItem(i);
      if (result.kind === "rejected") {
        ctx.onAttuneConflict?.(i);
      }
      if (result.unequipped?.length) {
        new Notice(`Unequipped ${result.unequipped.join(", ")} (slot occupied).`);
      }
    });
  }

  // Remove (existing ConfirmModal flow handled by editState.removeItem callers)
  const rmBtn = strip.createEl("button", { cls: "pc-inv-action danger", text: "Remove" });
  rmBtn.addEventListener("click", () => editState.removeItem(i));
}
