/**
 * Map an entity (or its absence) to a single icon name.
 *
 * Lucide names are tried first (Obsidian's `setIcon` ships them). For
 * domain-specific items (rings, wands, niche jewelry), Tabler names are
 * used — these must be registered via `registerTablerIcons` from
 * `src/modules/inquiry/shared/icons/tabler-icons.ts` for `setIcon` to
 * find them.
 *
 * The mapping is centralized so substitutions happen in one place.
 */

import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";

export function iconForEntity(
  resolved: ResolvedEquipped,
  _entry: EquipmentEntry,
): string {
  if (!resolved.entity) return "package"; // inline (non-slug) item — no compendium entry
  if (resolved.entityType === "weapon") return "sword";
  if (resolved.entityType === "armor")  return "shield";

  const type = (resolved.entity as { type?: string } | null)?.type?.toLowerCase();
  switch (type) {
    case "ring":           return "tabler-ring";
    case "potion":         return "flask-conical";
    case "scroll":         return "scroll";
    case "wand":
    case "staff":          return "tabler-wand";
    case "rod":            return "tabler-baseline";
    case "amulet":         return "tabler-needle";
    case "cloak":          return "shirt";
    case "tool":
    case "tools":          return "wrench";
    case "wondrous":       return "sparkles";
    default:               return "package";
  }
}
