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
import { renderInlineItemForm } from "./inline-item-form";
import { unequipWithAttunementCheck } from "./unequip-flow";
import { renderOverrideActionsPanel } from "./override-actions-panel";

export interface RowExpandCtx {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
  app: App;
  editState: CharacterEditState | null;
  onAttuneConflict?: (incomingIndex: number) => void;
}

export function renderRowExpand(parent: HTMLElement, ctx: RowExpandCtx): HTMLElement {
  const expand = parent.createDiv({ cls: "pc-inv-expand" });

  if (!ctx.resolved.entity) {
    if (ctx.editState) {
      const editState = ctx.editState;
      renderInlineItemForm(expand, {
        entry: ctx.entry,
        index: ctx.resolved.index,
        onChange: (patch) => editState.patchInlineItem(ctx.resolved.index, patch),
      });
    } else {
      expand.createDiv({ cls: "pc-inv-inline-form" })
        .createSpan({ text: ctx.entry.item, cls: "pc-inv-inline-name" });
    }
  } else if (ctx.resolved.entityType === "weapon") {
    expand.appendChild(renderWeaponBlock(ctx.resolved.entity as WeaponEntity));
  } else if (ctx.resolved.entityType === "armor") {
    expand.appendChild(renderArmorBlock(ctx.resolved.entity as ArmorEntity));
  } else {
    expand.appendChild(renderItemBlock(ctx.resolved.entity as Item));
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
      editState.equipItem(i);
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
    });
  }

  // Remove (existing ConfirmModal flow handled by editState.removeItem callers)
  const rmBtn = strip.createEl("button", { cls: "pc-inv-action danger", text: "Remove" });
  rmBtn.addEventListener("click", () => editState.removeItem(i));
}
