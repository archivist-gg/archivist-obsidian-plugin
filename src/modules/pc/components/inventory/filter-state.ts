import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";

export type StatusFilter = "all" | "equipped" | "attuned" | "carried";

export interface FilterState {
  status: StatusFilter;
  types: Set<string>;     // entityType ("weapon" | "armor") or item.type ("ring" | "potion" | …)
  rarities: Set<string>;  // normalized: lowercase, spaces→hyphens
  search: string;         // raw input
}

export interface VisibleEntry {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
}

export function prettifyName(item: string): string {
  const m = item.match(/^\[\[(.+)\]\]$/);
  if (m) return m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return item;
}

export function displayName(entry: EquipmentEntry, resolved: ResolvedEquipped): string {
  if (entry.overrides?.name) return entry.overrides.name;
  const e = resolved.entity as { name?: string } | null;
  if (e?.name) return e.name;
  return prettifyName(entry.item);
}

export function visibleItems(items: VisibleEntry[], filters: FilterState): VisibleEntry[] {
  const search = filters.search.trim().toLowerCase();

  // First: filter (preserves input order, which is the YAML order — needed for stable sort tiebreak)
  const filtered = items.filter(({ entry, resolved }) => {
    if (filters.status === "equipped" && !entry.equipped) return false;
    if (filters.status === "attuned"  && !entry.attuned)  return false;
    if (filters.status === "carried"  && (entry.equipped || entry.attuned)) return false;

    if (filters.types.size > 0) {
      const e = resolved.entity as { type?: string } | null;
      const t = resolved.entityType === "weapon" ? "weapon"
              : resolved.entityType === "armor"  ? "armor"
              : (e?.type ?? "").toLowerCase();
      if (!filters.types.has(t)) return false;
    }

    if (filters.rarities.size > 0) {
      const e = resolved.entity as { rarity?: string } | null;
      const r = (e?.rarity ?? "").toLowerCase().replace(/\s+/g, "-");
      if (!filters.rarities.has(r)) return false;
    }

    if (search.length > 0) {
      const name = displayName(entry, resolved).toLowerCase();
      const type = ((resolved.entity as { type?: string } | null)?.type ?? "").toLowerCase();
      if (!name.includes(search) && !type.includes(search)) return false;
    }

    return true;
  });

  // Then: stable alphabetical sort. Decorate-sort-undecorate to keep ties in original order.
  return filtered
    .map((item, index) => ({ item, index, key: displayName(item.entry, item.resolved).toLowerCase() }))
    .sort((a, b) => {
      const cmp = a.key.localeCompare(b.key);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map(({ item }) => item);
}
