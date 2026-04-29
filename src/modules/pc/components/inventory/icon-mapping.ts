/**
 * Map an entity (or its absence) to an icon name suitable for
 * `setInventoryIcon` (see `../../assets/inventory-icons.ts`).
 *
 * Returned names fall in two categories:
 * - Inlined game-icons.net keys (e.g. `axe`, `bow`, `chain-mail`, `ring`,
 *   `wand`) — resolved by the `INVENTORY_ICONS` registry.
 * - Lucide built-ins (e.g. `sword`, `shield`, `sparkles`, `flask-conical`,
 *   `scroll`, `wrench`, `package`) — resolved by Obsidian's `setIcon`.
 *
 * Discrimination rules:
 * - Weapons → by `WeaponEntity.slug`.
 * - Armor   → by `ArmorEntity.category` (lowercased, with the literal
 *             "armor"/"armour" suffix stripped, so SRD's "Light Armor"
 *             collapses to "light").
 * - Items   → by `ItemEntity.type`. SRD magic-item types include a
 *             parenthetical like "Weapon (any sword)" or "Armor (chain shirt)";
 *             we strip the parenthetical and route weapons/armor through the
 *             corresponding helper, so a `+1 longsword` registered as
 *             `Weapon (longsword)` still resolves to a sword icon.
 */

import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";

export function iconForEntity(
  resolved: ResolvedEquipped,
  _entry: EquipmentEntry,
): string {
  if (!resolved.entity) return "alert-triangle"; // orphan row — entry has no compendium entity

  if (resolved.entityType === "weapon") return iconForWeapon(resolved.entity);
  if (resolved.entityType === "armor")  return iconForArmor(resolved.entity);

  return iconForItem(resolved.entity);
}

/**
 * Discriminate a weapon by slug. Substring matching is intentionally lenient
 * because SRD slugs use a mix of bare and prefixed forms (`longsword`,
 * `shortsword`, `crossbow-light`, `light-hammer`).
 *
 * Order matters: `crossbow` MUST be checked before `bow` because the
 * crossbow slugs (`crossbow-light`, `crossbow-heavy`, `crossbow-hand`)
 * contain the substring `bow`.
 */
function iconForWeapon(entity: unknown): string {
  const slug = (entity as { slug?: string } | null)?.slug?.toLowerCase() ?? "";
  if (!slug) return "sword";

  if (slug.includes("crossbow")) return "crossbow";
  if (slug.includes("bow"))      return "bow"; // longbow, shortbow
  if (slug.includes("axe") || slug === "glaive" || slug === "halberd") return "axe";
  if (slug === "dagger" || slug === "dart" || slug === "sickle") return "dagger";
  if (slug.includes("hammer") || slug === "maul") return "hammer";
  if (
    slug === "mace" ||
    slug === "morningstar" ||
    slug === "flail" ||
    slug === "club" ||
    slug === "greatclub" ||
    slug === "quarterstaff" ||
    slug === "war-pick"
  ) {
    return "mace";
  }
  if (
    slug.includes("spear") ||
    slug === "pike" ||
    slug === "javelin" ||
    slug === "lance" ||
    slug === "trident"
  ) {
    return "spear";
  }
  if (slug === "whip") return "whip";
  if (slug === "net" || slug === "sling" || slug === "blowgun") return "bow-thrown";

  // Default: longsword, shortsword, greatsword, scimitar, rapier, "sword", etc.
  return "sword";
}

/**
 * Discriminate armor by category. Accepts the SRD's `"Light Armor"` /
 * `"Heavy Armor"` / `"Shield"` casing as well as the canonical
 * lowercase `"light"` / `"medium"` / `"heavy"` / `"shield"`.
 */
function iconForArmor(entity: unknown): string {
  const raw = (entity as { category?: string } | null)?.category ?? "";
  const cat = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*armou?r\s*$/, "") // "light armor" -> "light"
    .trim();

  switch (cat) {
    case "light":  return "leather";
    case "medium": return "chain-mail";
    case "heavy":  return "breastplate";
    case "shield": return "shield";
    default:       return "shield";
  }
}

/**
 * Discriminate an item by type. Normalizes:
 * - Lowercase.
 * - Strip parenthetical: `"Weapon (any sword)"` -> `"weapon"`.
 * - Strip trailing ` item`: `"wondrous item"` -> `"wondrous"`.
 *
 * SRD magic items often nest weapons/armor under `type: "Weapon (longsword)"`
 * or `type: "Armor (chain shirt)"`. When the simplified type collapses to
 * `weapon` or `armor`, route through the corresponding helper using the
 * parenthetical inner text as a synthetic slug/category.
 */
function iconForItem(entity: unknown): string {
  const e = entity as { type?: string; slug?: string; category?: string } | null;
  const rawType = e?.type?.toLowerCase().trim() ?? "";
  const parenMatch = rawType.match(/^([^()]+?)\s*\(([^)]+)\)\s*$/);
  const baseType = (parenMatch ? parenMatch[1] : rawType).trim();
  const parenInner = parenMatch ? parenMatch[2].trim() : "";
  const simplifiedType = baseType.replace(/\s+item$/, "");

  if (simplifiedType === "weapon") {
    // Use the parenthetical as a synthetic slug, falling back to entity.slug.
    const synthSlug = parenInner || e?.slug || "";
    return iconForWeapon({ slug: synthSlug });
  }
  if (simplifiedType === "armor") {
    const synthCategory = parenInner || e?.category || "";
    return iconForArmor({ category: synthCategory });
  }

  switch (simplifiedType) {
    case "ring":     return "ring";
    case "amulet":   return "amulet";
    case "cloak":    return "cloak";
    case "wand":     return "wand";
    case "staff":    return "staff";
    case "rod":      return "rod";
    case "potion":   return "flask-conical";
    case "scroll":   return "scroll";
    case "wondrous": return "sparkles";
    case "tool":
    case "tools":    return "wrench";
    default:         return "package";
  }
}
