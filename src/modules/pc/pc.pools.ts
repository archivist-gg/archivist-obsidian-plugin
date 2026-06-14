import type { RegisteredEntity } from "../../shared/entities/entity-registry";
import type { ResolvedCharacter, ResolvedClass, ResolvedPool, ResolvedPoolEntry } from "./pc.types";
import type { SelectionPool } from "../../shared/types/selection-pool";
import type { OptionalFeatureEntity } from "../optional-feature/optional-feature.types";
import { readTableColumn } from "./pc.table-column";
import { bareEntitySlug, wikilinkTailSlug } from "./pc.decision-engine";

/** Structural subset of EntityRegistry used here (lets tests pass a fake). */
export interface PoolRegistry {
  search(query: string, entityType: string, limit: number): RegisteredEntity[];
  getByTypeAndSlug(entityType: string, slug: string): RegisteredEntity | undefined;
}

function levelPrereqMax(d: OptionalFeatureEntity): number {
  return (d.prerequisites ?? [])
    .filter((p) => p.kind === "level")
    .reduce((m, p) => Math.max(m, (p as { min: number }).min), 0);
}

function resolveOF(registry: PoolRegistry, slug: string): ResolvedPoolEntry | null {
  let reg = registry.getByTypeAndSlug("optional-feature", slug);
  if (!reg) {
    const want = bareEntitySlug(slug);
    reg = registry.search("", "optional-feature", Number.POSITIVE_INFINITY)
      .find((e) => bareEntitySlug(e.slug) === want);
  }
  return reg ? { slug: reg.slug, entity: reg.data as unknown as OptionalFeatureEntity } : null;
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

  const ft = pool.source.where.feature_type;
  const available: ResolvedPoolEntry[] = registry
    .search("", "optional-feature", Number.POSITIVE_INFINITY)
    .filter((e) => {
      const d = e.data as unknown as OptionalFeatureEntity;
      if (d.feature_type !== ft) return false;
      if (!(d.available_to ?? []).some((l) => wikilinkTailSlug(l) === ownerBare)) return false;
      return levelPrereqMax(d) <= level;
    })
    .map((e) => ({ slug: e.slug, entity: e.data as unknown as OptionalFeatureEntity }));

  const raw = (rc.choices[anchorLevel] as Record<string, unknown> | undefined)?.[pool.id];
  const selectedSlugs = Array.isArray(raw) ? (raw as string[]) : typeof raw === "string" ? [raw] : [];
  const selected = selectedSlugs
    .map((s) => resolveOF(registry, s))
    .filter((e): e is ResolvedPoolEntry => e != null);

  const grants = (rc.subclass?.pool_grants ?? [])
    .filter((g) => g.pool === pool.id)
    .flatMap((g) => g.grants)
    .filter((g) => g.at_level <= level)
    .map((g) => resolveOF(registry, wikilinkTailSlug(g.feature)))
    .filter((e): e is ResolvedPoolEntry => e != null);

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
