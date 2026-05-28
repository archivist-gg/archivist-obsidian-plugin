// src/modules/pc/components/defense-type-popover-logic.ts

/** The kind the row is currently in, or null when no category is set. */
export type DefenseRowState = "resistance" | "immunity" | "vulnerability" | null;

/** The pip the user tapped. */
export type TappedPip = "resistance" | "immunity" | "vulnerability";

/**
 * The mutation pair that resolves a tri-state tap. `addKind` and `removeKind`
 * map to the `kind` argument of `CharacterEditState.{addDefense,removeDefense}`:
 *
 * - `"resistance"` → `"resistances"`
 * - `"immunity"` → `"immunities"`
 * - `"vulnerability"` → `"vulnerabilities"`
 *
 * Either field may be undefined when the cycle calls for an add-only or
 * remove-only transition. Both are undefined only if `current === tapped` is
 * impossible — this function never returns an all-empty action.
 */
export interface CycleAction {
  removeKind?: TappedPip;
  addKind?: TappedPip;
}

/**
 * Decide which `editState` calls to fire when a user taps a tri-state pip.
 *
 * Rules (mutually exclusive R / I / V — see spec §4.1):
 * - Tapping the currently active pip clears the row (remove-only).
 * - Tapping a different pip on a row with a state swaps (remove + add).
 * - Tapping any pip on a neutral row sets that kind (add-only).
 */
export function cycleAction(current: DefenseRowState, tapped: TappedPip): CycleAction {
  if (current === tapped) return { removeKind: current };
  if (current === null) return { addKind: tapped };
  return { removeKind: current, addKind: tapped };
}

/** Map the public pip kind to the storage kind used by `editState`. */
export function defenseKindFor(pip: TappedPip): "resistances" | "immunities" | "vulnerabilities" {
  if (pip === "resistance") return "resistances";
  if (pip === "immunity") return "immunities";
  return "vulnerabilities";
}
