import type { EntityRegistry } from "@archivist/core";
import { resolveBaseItem } from "../../shared/entities/base-item-resolver";
import type { ItemEntity } from "../item/item.types";
import type { ArmorEntity } from "@archivist/dnd5e/armor/armor.types";
import type { WeaponEntity } from "@archivist/dnd5e/weapon/weapon.types";
import type { SlotKey } from "./pc.types";

export function isItemEntity(e: unknown): e is ItemEntity {
  return !!e && typeof e === "object" && "rarity" in e;
}

export function isWeaponEntity(e: unknown): e is WeaponEntity {
  if (!e || typeof e !== "object") return false;
  if (!("damage" in e) || !("category" in e)) return false;
  const cat = (e as { category: unknown }).category;
  return typeof cat === "string" && /melee|ranged/.test(cat);
}

export function isArmorEntity(e: unknown): e is ArmorEntity {
  return !!e && typeof e === "object" && "ac" in e && "category" in e && !("damage" in e);
}

/** Resolve an equipment entry's `item` wikilink (or bare slug) through the shared
 *  base-item resolver so vault-path wikilinks, alias wikilinks, AND
 *  compendium-prefixed slugs all resolve consistently. */
export function resolveEntityForEntry(
  item: string,
  registry: EntityRegistry,
): { entity: ArmorEntity | WeaponEntity | ItemEntity | null; entityType: string | null } {
  const found = resolveBaseItem(item, registry);
  if (!found) return { entity: null, entityType: null };
  return {
    entity: found.data as unknown as ArmorEntity | WeaponEntity | ItemEntity,
    entityType: found.entityType,
  };
}

/** Is this armor a shield? Robust to SRD-2024 data where the Shield entity
 *  carries `category: "heavy"` rather than `"shield"`. */
export function isShieldArmor(armor: ArmorEntity): boolean {
  if (armor.category === "shield") return true;
  const slug = (armor.slug ?? "").toLowerCase();
  if (slug === "shield" || slug.endsWith("_shield") || slug.endsWith("-shield")) return true;
  return (armor.name ?? "").trim().toLowerCase() === "shield";
}

/** The ArmorEntity whose `ac` block governs a slot: the entity itself when armor,
 *  or — for a magic item whose `base_item` points at armor — the resolved base. */
export function effectiveArmor(
  entity: ArmorEntity | WeaponEntity | ItemEntity | null | undefined,
  registry: EntityRegistry,
): ArmorEntity | null {
  if (isArmorEntity(entity)) return entity;
  if (isItemEntity(entity) && typeof entity.base_item === "string") {
    const base = resolveBaseItem(entity.base_item, registry);
    if (base?.entityType === "armor") return base.data as unknown as ArmorEntity;
  }
  return null;
}

export function defaultSlotForType(
  entityType: string | null,
  entity: ArmorEntity | WeaponEntity | ItemEntity | null,
  registry: EntityRegistry,
): SlotKey | null {
  if (entityType === "weapon") return "mainhand";
  if (entityType === "armor") {
    return isArmorEntity(entity) && isShieldArmor(entity) ? "shield" : "armor";
  }
  // Magic items with a base_item pointing to a known weapon/armor route to the
  // matching slot so they participate in attack rows / AC.
  if (entityType === "item" && isItemEntity(entity) && typeof entity.base_item === "string") {
    const base = resolveBaseItem(entity.base_item, registry);
    if (base?.entityType === "weapon") return "mainhand";
    if (base?.entityType === "armor") {
      const armorData = base.data as unknown as ArmorEntity;
      return isShieldArmor(armorData) ? "shield" : "armor";
    }
  }
  return null;
}
