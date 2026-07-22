import type { EquipmentGrant } from "@archivist-gg/dnd5e/types/equipment-grant";
import type { SlotKey } from "@archivist-gg/dnd5e/pc/pc.types";

export interface GrantedEntry { slug: string; qty: number; equipped: boolean; slot: SlotKey | null; }

/** Thin registry surface the seeder needs — adapted from the EntityRegistry. */
export interface SeedRegistry {
  /** Resolve a bare slug ("chain-mail") to its full slug + entityType (+ pack
   *  contents, bare slugs, when the item is a container/pack). Null if unknown. */
  lookup(bareSlug: string): { fullSlug: string; entityType: string; packContents?: string[] } | null;
  /** Whether a resolved armor entity is a shield (slot "shield" vs "armor"). */
  isShield(bareSlug: string): boolean;
}

/**
 * Resolve a flat grant list into seedable entries + total gold. `categoryPicks`
 * maps a nested category-child key → the chosen full slug; `categoryKeys` lists
 * the child keys in the SAME ORDER as the `{category}` grants appear, so the
 * nth category grant consumes the nth key. Armor → equipped+slot; shields →
 * slot "shield"; packs expand into their contents (the pack item is dropped).
 */
export function resolveGrants(
  grants: EquipmentGrant[],
  categoryPicks: Record<string, string>,
  reg: SeedRegistry,
  categoryKeys: string[] = [],
): { entries: GrantedEntry[]; gold: number } {
  const entries: GrantedEntry[] = [];
  let gold = 0;
  let catIdx = 0;
  const pushBare = (bare: string, qty: number) => {
    const r = reg.lookup(bare);
    if (!r) return; // unresolved → skip (graceful; logged by caller)
    if (r.packContents?.length) {
      for (const c of r.packContents) pushBare(c, 1);
      return;
    }
    const slot: SlotKey | null = r.entityType === "armor" ? (reg.isShield(bare) ? "shield" : "armor") : null;
    entries.push({ slug: r.fullSlug, qty, equipped: slot !== null, slot });
  };
  const pushFull = (full: string) => {
    // Arity-robust prefix strip: a full slug is `<prefix>_<type>_<name>` (3-part)
    // or the legacy `<prefix>_<name>` (2-part); a bare slug has no `_`. Name-slugs
    // never contain `_`, so `parts.slice(2).join("_")` is the bare name for 3-part.
    const p = full.split("_");
    const bare = p.length >= 3 ? p.slice(2).join("_") : p[p.length - 1];
    pushBare(bare, 1);
  };
  for (const g of grants) {
    if ("gold" in g) { gold += g.gold; continue; }
    if ("category" in g) {
      const key = categoryKeys[catIdx++];
      const picked = key ? categoryPicks[key] : undefined;
      if (picked) pushFull(picked);
      continue;
    }
    pushBare(g.item, g.qty ?? 1);
  }
  return { entries, gold };
}
