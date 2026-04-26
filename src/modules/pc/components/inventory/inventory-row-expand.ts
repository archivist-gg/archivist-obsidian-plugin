import type { App } from "obsidian";
import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import { renderItemBlock } from "../../../item/item.renderer";
import { renderWeaponBlock } from "../../../weapon/weapon.renderer";
import { renderArmorBlock } from "../../../armor/armor.renderer";
import type { WeaponEntity } from "../../../weapon/weapon.types";
import type { ArmorEntity } from "../../../armor/armor.types";
import type { Item } from "../../../item/item.types";
import type {
  Condition,
  ConditionalBonus,
  BonusFieldPath,
} from "../../../item/item.conditions.types";
import { conditionsToText } from "../../../item/item.conditions";
import { requiresAttunement } from "./requires-attunement";
import { renderInlineItemForm } from "./inline-item-form";
import { unequipWithAttunementCheck } from "./unequip-flow";

interface SituationalLine {
  field: BonusFieldPath;
  value: number;
  conditions: Condition[];
}

function isConditionalBonus(x: unknown): x is ConditionalBonus {
  return !!x && typeof x === "object" && Array.isArray((x as { when?: unknown }).when);
}

function collectSituational(item: Item): SituationalLine[] {
  const out: SituationalLine[] = [];
  const b = item.bonuses;
  if (!b) return out;

  for (const key of [
    "ac", "saving_throws", "spell_attack", "spell_save_dc",
    "weapon_attack", "weapon_damage",
  ] as const) {
    const v = b[key];
    if (isConditionalBonus(v)) {
      out.push({ field: key, value: v.value, conditions: v.when });
    }
  }

  if (b.speed) {
    for (const k of ["walk", "fly", "swim", "climb"] as const) {
      const v = b.speed[k];
      if (isConditionalBonus(v)) {
        out.push({ field: `speed.${k}`, value: v.value, conditions: v.when });
      }
    }
  }

  if (b.ability_scores?.bonus) {
    for (const [k, v] of Object.entries(b.ability_scores.bonus)) {
      if (isConditionalBonus(v)) {
        out.push({ field: `ability_scores.bonus.${k}` as BonusFieldPath, value: v.value, conditions: v.when });
      }
    }
  }

  return out;
}

function fieldShortLabel(field: BonusFieldPath): string {
  if (field === "ac") return "AC";
  if (field === "saving_throws") return "saves";
  if (field === "spell_attack") return "spell atk";
  if (field === "spell_save_dc") return "spell DC";
  if (field === "weapon_attack") return "weapon atk";
  if (field === "weapon_damage") return "weapon dmg";
  if (field.startsWith("speed.")) return field.slice("speed.".length) + " speed";
  if (field.startsWith("ability_scores.bonus.")) return field.slice("ability_scores.bonus.".length).toUpperCase();
  return field;
}

function renderSituationalCaption(parent: HTMLElement, item: Item): void {
  const lines = collectSituational(item);
  if (lines.length === 0) return;
  const cap = parent.createDiv({ cls: "pc-inv-expand-situational" });
  cap.createDiv({ cls: "pc-inv-expand-situational-title", text: "Situational bonuses" });
  for (const l of lines) {
    const li = cap.createDiv({ cls: "pc-inv-expand-situational-line" });
    const sign = l.value >= 0 ? "+" : "";
    li.setText(`- ${sign}${l.value} ${fieldShortLabel(l.field)} ${conditionsToText(l.conditions)}`);
  }
}

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

  // Situational bonuses caption - independent of weapon/armor/item branch.
  if (ctx.resolved.entityType === "item" && ctx.resolved.entity) {
    renderSituationalCaption(expand, ctx.resolved.entity as Item);
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
