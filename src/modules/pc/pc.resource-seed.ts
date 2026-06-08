import type { ResolvedCharacter, DerivedStats, FeatureSource } from "./pc.types";
import { evaluateMaxFormula, resolveMaxAt, type FormulaBindings } from "../../shared/dnd/resource-formula";

/** Build the DSL bindings for a resource granted via `source`. `class_level`
 *  is the character's level in the granting class (total level for non-class
 *  sources); ability mods come from the final (post-bonus) derived mods. */
export function resourceBindings(
  resolved: ResolvedCharacter,
  derived: DerivedStats,
  source: FeatureSource,
): FormulaBindings {
  const classLevel = source.kind === "class" || source.kind === "subclass"
    ? (resolved.classes.find((c) => c.entity?.slug === source.slug)?.level ?? resolved.totalLevel)
    : resolved.totalLevel;
  return {
    level: resolved.totalLevel,
    class_level: classLevel,
    prof: derived.proficiencyBonus,
    str_mod: derived.mods.str, dex_mod: derived.mods.dex, con_mod: derived.mods.con,
    int_mod: derived.mods.int, wis_mod: derived.mods.wis, cha_mod: derived.mods.cha,
  };
}

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
