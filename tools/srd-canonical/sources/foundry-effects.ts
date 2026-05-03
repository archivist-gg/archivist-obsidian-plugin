// tools/srd-canonical/sources/foundry-effects.ts
//
// Translate Foundry-effect changes into typed bonus contributions.
// Pure function — no I/O. The merger reconciler consumes these and
// folds them into the canonical ItemBonuses block.

import type {
  BonusFieldPath,
  Condition,
} from "../../../src/modules/item/item.conditions.types";

export interface FoundryChange {
  key: string;
  mode: "ADD" | "OVERRIDE" | "DOWNGRADE" | "UPGRADE" | "MULTIPLY" | "CUSTOM" | string;
  value: number | string;
}

/** A scalar `bonuses.<field>` contribution with optional gating. */
export interface FoundryBonusContribution {
  tag: "bonus";
  field: BonusFieldPath;
  value: number;
  /** Empty array means unconditional (equipped is the gate). */
  when: Condition[];
}

/** A `bonuses.ability_scores.static.<ab>` setter (no `when[]`). */
export interface FoundryStaticContribution {
  tag: "static";
  ability: "str" | "dex" | "con" | "int" | "wis" | "cha";
  value: number;
}

/** Anything that lands on a non-bonuses ItemCanonical slot. */
export type FoundrySideChannel =
  | { tag: "side-channel"; kind: "immune"; value: string }
  | { tag: "side-channel"; kind: "resist"; value: string }
  | { tag: "side-channel"; kind: "vulnerable"; value: string }
  | { tag: "side-channel"; kind: "sense"; sense: "darkvision" | "tremorsense" | "truesight" | "blindsight"; value: number }
  | { tag: "side-channel"; kind: "grants_proficiency"; value: string };

export type FoundryContribution =
  | FoundryBonusContribution
  | FoundryStaticContribution
  | FoundrySideChannel;

/**
 * Translate a list of Foundry effect changes into typed contributions.
 *
 * - `mode` other than `"ADD"` is logged and skipped.
 * - Unknown keys are logged and skipped.
 * - Non-numeric values where numbers are expected are logged and skipped.
 *
 * Logs go to stderr; the audit CLI surfaces them in its report.
 */
export function translateFoundryChanges(
  changes: FoundryChange[],
  itemName: string,
): FoundryContribution[] {
  void itemName;
  void changes;
  return [];
}
