import type { ResolvedCharacter, DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";
import { evaluateMaxFormula, resolveMaxAt } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { resourceBindings } from "@archivist-gg/dnd5e/pc/pc.resource-seed";

/**
 * Seed `resolved.state.feature_uses` from every owned resource's level-resolved
 * `max_formula`. `max` is a recomputed cache; `used` is preserved and clamped to
 * the new max. Same-id pools across sources merge (max of computed maxes).
 *
 * `resolved.state` is the same object reference as the persisted Character's
 * state (the resolver passes it through), so mutating it here persists.
 */
export function seedFeatureUses(resolved: ResolvedCharacter, derived: DerivedStats): void {
  const fu = resolved.state.feature_uses ?? (resolved.state.feature_uses = {});
  const computed: Record<string, number> = {};

  for (const rf of resolved.features ?? []) {
    const resources = rf.feature.resources;
    if (!resources?.length) continue;
    const bindings = resourceBindings(resolved, derived, rf.source);
    for (const r of resources) {
      if (!r.id) continue;
      let max: number;
      try {
        const raw = evaluateMaxFormula(resolveMaxAt(resolved.totalLevel, r), bindings);
        // Guard non-finite (e.g. a theoretical divide-by-zero formula) so we never seed Infinity/NaN.
        max = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      } catch {
        continue; // malformed formula (already rejected at build time; defensive)
      }
      computed[r.id] = computed[r.id] === undefined ? max : Math.max(computed[r.id], max);
    }
  }

  // Seeding only adds/updates ids that are currently granted; stale ids from
  // no-longer-owned features are intentionally left untouched (not pruned).
  for (const [id, max] of Object.entries(computed)) {
    const used = Math.min(fu[id]?.used ?? 0, max);
    fu[id] = { used, max };
  }
}
