import type { RegisteredEntity } from "@archivist/core";
import type { ResolvedCharacter, ResolvedClass, ResolvedPool, ResolvedPoolEntry } from "./pc.types";
import type { SelectionPool } from "@archivist/dnd5e/types/selection-pool";
import type { OptionalFeatureEntity } from "@archivist/dnd5e/types/optional-feature.types";
import { readTableColumn } from "./pc.table-column";
import { bareEntitySlug, wikilinkTailSlug } from "./pc.decision-engine";

/** Structural subset of EntityRegistry used here (lets tests pass a fake). */
export interface PoolRegistry {
  search(query: string, entityType: string, limit: number): RegisteredEntity[];
  getByTypeAndSlug(entityType: string, slug: string): RegisteredEntity | undefined;
}

function levelPrereqMax(d: OptionalFeatureEntity): number {
  return (d.prerequisites ?? [])
    .filter((p): p is { kind: "level"; min: number } => p.kind === "level")
    .reduce((m, p) => Math.max(m, p.min), 0);
}

export function resolvePool(
  rc: ResolvedClass,
  classIndex: number,
  pool: SelectionPool,
  registry: PoolRegistry,
): ResolvedPool {
  const entity = rc.entity!;
  const level = rc.level;
  const ownerBare = bareEntitySlug(entity.slug);
  const col = pool.count.column;

  const count = readTableColumn(entity.table, level, [col]) ?? 0;

  let anchorLevel = 1;
  for (let l = 1; l <= 20; l++) {
    const c = readTableColumn(entity.table, l, [col]);
    if (c != null && c >= 1) { anchorLevel = l; break; }
  }

  // One scan of all optional-features: build the prereq-filtered `available` list
  // AND a bare-slug → entry map for O(1) pick/grant resolution (mirrors
  // enumerateOptions' single-scan pattern). The map is built from the FULL scan
  // (not the prereq-filtered list) so a stored pick or explicit subclass grant
  // still resolves to its entity even when prereqs would hide it from `available`.
  const ft = pool.source.where.feature_type;
  const all = registry.search("", "optional-feature", Number.POSITIVE_INFINITY);
  const byBare = new Map<string, ResolvedPoolEntry>();
  const available: ResolvedPoolEntry[] = [];
  for (const e of all) {
    const d = e.data as unknown as OptionalFeatureEntity;
    const entry: ResolvedPoolEntry = { slug: e.slug, entity: d };
    byBare.set(bareEntitySlug(e.slug), entry);
    if (d.feature_type !== ft) continue;
    if (!(d.available_to ?? []).some((l) => wikilinkTailSlug(l) === ownerBare)) continue;
    if (levelPrereqMax(d) > level) continue;
    available.push(entry);
  }

  // pool_grants authoring (class OR subclass frontmatter):
  //   pool_grants:
  //     - pool: <pool id from selection_pools>
  //       grants:
  //         - feature: "[[boon-slug]]"
  //           at_level: 3
  // Granted picks render in the pool tab's "Granted" section and do NOT count
  // toward the pool's pick budget. Class- and subclass-declared grants merge;
  // duplicates (same feature) collapse to one; a feature that is both granted
  // and manually selected shows only as granted (granted wins, no pick consumed).
  const grantDecls = [
    ...(rc.entity?.pool_grants ?? []),
    ...(rc.subclass?.pool_grants ?? []),
  ];
  const grantsRaw = grantDecls
    .filter((g) => g.pool === pool.id)
    .flatMap((g) => g.grants)
    .filter((g) => g.at_level <= level)
    .map((g) => byBare.get(wikilinkTailSlug(g.feature)))
    .filter((e): e is ResolvedPoolEntry => e != null);
  const grantedBare = new Set<string>();
  const grants = grantsRaw.filter((e) => {
    const key = bareEntitySlug(e.slug);
    if (grantedBare.has(key)) return false;
    grantedBare.add(key);
    return true;
  });

  const raw = (rc.choices[anchorLevel] as Record<string, unknown> | undefined)?.[pool.id];
  const selectedSlugs = Array.isArray(raw) ? (raw as string[]) : typeof raw === "string" ? [raw] : [];
  const selected = selectedSlugs
    .map((s) => byBare.get(bareEntitySlug(s)))
    .filter((e): e is ResolvedPoolEntry => e != null)
    .filter((e) => !grantedBare.has(bareEntitySlug(e.slug)));

  return { id: pool.id, label: pool.label, classIndex, count, anchorLevel, selected, available, grants };
}

export function resolveAllPools(resolved: ResolvedCharacter, registry: PoolRegistry): ResolvedPool[] {
  const out: ResolvedPool[] = [];
  resolved.classes.forEach((rc, classIndex) => {
    if (!rc.entity) return;
    const decls = [...(rc.entity.selection_pools ?? []), ...(rc.subclass?.selection_pools ?? [])];
    const seen = new Set<string>();
    for (const pool of decls) {
      if (seen.has(pool.id)) continue;
      seen.add(pool.id);
      out.push(resolvePool(rc, classIndex, pool, registry));
    }
  });
  return out;
}
