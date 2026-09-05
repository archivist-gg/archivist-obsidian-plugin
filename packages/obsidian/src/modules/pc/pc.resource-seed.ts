import type { ResolvedCharacter, DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";
import { resolveMaxCountAt } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { resourceBindings } from "@archivist-gg/dnd5e/pc/pc.resource-seed";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { warnOnce } from "@archivist-gg/dnd5e/dnd/warn-once";

/**
 * Seed `resolved.state.feature_uses` from every owned resource's level-resolved
 * `max_formula`. The level a resource's `scales_at` steps are read at is the
 * OWNER's class level (R4-G4 §6.2.4: `resourceLevelFor`), the same level
 * `resourceBindings` binds `class_level` to, never the character's total level.
 * `max` is a recomputed cache; `used` is preserved and clamped to
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
    const level = resourceLevelFor(rf.source, resolved);   // the OWNER's class level (R4-G4 §6.2.4), never the total
    for (const r of resources) {
      if (!r.id) continue;
      let max: number;
      try {
        const raw = resolveMaxCountAt(level, r, bindings);
        if (raw === null) {
          // No parsing step and no parsing base: a damage die (Sneak Attack "1d6"), correctly no tracker.
          // There is NO build-time gate on max_formula (isValidMaxFormula has zero production callers), so
          // the reader says so, once per id, instead of swallowing it.
          warnOnce(`resource-seed:${r.id}`, `feature_uses: "${r.id}" has no parseable max_formula (${JSON.stringify(r.max_formula)}); not seeded`);
          continue;
        }
        // Guard non-finite (e.g. a theoretical divide-by-zero formula) so we never seed Infinity/NaN.
        max = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      } catch (e) {
        warnOnce(`resource-seed:${r.id}`, `feature_uses: "${r.id}" max_formula threw (${String(e)}); not seeded`);
        continue;
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
