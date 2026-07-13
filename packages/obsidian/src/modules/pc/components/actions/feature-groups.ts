import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";

/** The four action-economy buckets the Actions tab groups features into. */
export type FeatureGroupKey = "actions" | "bonus" | "reactions" | "passive";

export interface GroupedFeatures {
  actions: ResolvedFeature[];
  bonus: ResolvedFeature[];
  reactions: ResolvedFeature[];
  passive: ResolvedFeature[];
}

/**
 * Bucket `resolved.features` by action economy (spec §3.1). The mapping is
 * driven ENTIRELY by `feature.action`:
 *   - `action` / `free`  → Actions
 *   - `bonus-action`     → Bonus Actions
 *   - `reaction`         → Reactions
 *   - `special` / absent → Passive & Always-Active
 *
 * `passive === true` is subsumed by the "absent" arm: a feature carrying an
 * authored non-`special` action lands in its economy group (precedence —
 * "authored action beats passive"), while a passive-flagged feature with no
 * such action falls through to Passive. So `feature.passive` never needs an
 * explicit read.
 *
 * `renderSuppressed` entries (the #3 chosen-option synthetics, whose prose is
 * folded onto their parent via `chosenInline`) are SKIPPED entirely.
 *
 * Every surviving entry appears in EXACTLY ONE bucket, per ENTRY — legitimate
 * repeats (multiclass grants, multi-level listings) are NOT deduped by name.
 */
export function groupFeatures(resolved: ResolvedCharacter): GroupedFeatures {
  const groups: GroupedFeatures = { actions: [], bonus: [], reactions: [], passive: [] };
  for (const rf of resolved.features ?? []) {
    if (rf.renderSuppressed) continue;
    switch (rf.feature.action) {
      case "action":
      case "free":
        groups.actions.push(rf);
        break;
      case "bonus-action":
        groups.bonus.push(rf);
        break;
      case "reaction":
        groups.reactions.push(rf);
        break;
      // "special", undefined, and (implicitly) passive-flagged features:
      default:
        groups.passive.push(rf);
        break;
    }
  }
  return groups;
}
