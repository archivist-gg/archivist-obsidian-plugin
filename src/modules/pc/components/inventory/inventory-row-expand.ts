import type { App } from "obsidian";
import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import { renderItemBlock } from "../../../item/item.renderer";
import { renderWeaponBlock } from "../../../weapon/weapon.renderer";
import { renderArmorBlock } from "../../../armor/armor.renderer";
import type { WeaponEntity } from "../../../weapon/weapon.types";
import type { ArmorEntity } from "../../../armor/armor.types";
import type { Item } from "../../../item/item.types";
import { requiresAttunement } from "./requires-attunement";

export interface RowExpandCtx {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
  app: App;
  editState: CharacterEditState | null;
}

export function renderRowExpand(parent: HTMLElement, ctx: RowExpandCtx): HTMLElement {
  const expand = parent.createDiv({ cls: "pc-inv-expand" });

  if (!ctx.resolved.entity) {
    // Inline custom item — defer to inline-item-form (Task 24). For now, placeholder.
    const placeholder = expand.createDiv({ cls: "pc-inv-inline-form" });
    placeholder.createSpan({ text: ctx.entry.item, cls: "pc-inv-inline-name" });
  } else if (ctx.resolved.entityType === "weapon") {
    expand.appendChild(renderWeaponBlock(ctx.resolved.entity as WeaponEntity));
  } else if (ctx.resolved.entityType === "armor") {
    expand.appendChild(renderArmorBlock(ctx.resolved.entity as ArmorEntity));
  } else {
    expand.appendChild(renderItemBlock(ctx.resolved.entity as Item));
  }

  // PC-actions strip — sits below the block, separate concern.
  if (ctx.editState) renderActionsStrip(expand, ctx, ctx.editState);
  return expand;
}

function renderActionsStrip(parent: HTMLElement, ctx: RowExpandCtx, editState: CharacterEditState): void {
  const strip = parent.createDiv({ cls: "pc-inv-actions" });
  const i = ctx.resolved.index;

  // Equip / Unequip
  const equipBtn = strip.createEl("button", { cls: "pc-inv-action", text: ctx.entry.equipped ? "Unequip" : "Equip" });
  if (ctx.entry.equipped) equipBtn.classList.add("active");
  equipBtn.addEventListener("click", () => {
    if (ctx.entry.equipped) editState.unequipItem(i);
    else editState.equipItem(i);
  });

  // Attune / Unattune — only when required
  if (requiresAttunement(ctx.resolved.entity)) {
    const attuneBtn = strip.createEl("button", { cls: "pc-inv-action", text: ctx.entry.attuned ? "Unattune" : "Attune" });
    if (ctx.entry.attuned) attuneBtn.classList.add("active");
    attuneBtn.addEventListener("click", () => {
      if (ctx.entry.attuned) editState.unattuneItem(i);
      else editState.attuneItem(i);
    });
  }

  // Remove (existing ConfirmModal flow handled by editState.removeItem callers)
  const rmBtn = strip.createEl("button", { cls: "pc-inv-action danger", text: "Remove" });
  rmBtn.addEventListener("click", () => editState.removeItem(i));
}
