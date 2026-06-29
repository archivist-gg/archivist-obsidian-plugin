import type { FeatureEffect } from "./feature-effect";
import type { ActionCost, ResetTrigger, ResourceConsumption } from "./resource";
import type { Duration } from "../schemas/duration-schema";
import type { Edition } from "./edition";

/**
 * Documentation-only union of the canonical SRD feature types. The
 * `feature_type` field is now an open string (see {@link OptionalFeatureEntity})
 * so homebrew categories parse; this union is kept purely as a reference list.
 */
export type OptionalFeatureKind =
  | "invocation"        // warlock eldritch invocations
  | "fighting_style"    // fighter / paladin / ranger
  | "metamagic"         // sorcerer
  | "maneuver"          // battle master (non-SRD; future)
  | "infusion";         // artificer (non-SRD; future)

export type OptionalFeaturePrerequisite =
  | { kind: "level"; min: number }
  | { kind: "spell-known"; spell: string }
  | { kind: "pact"; pact: "tome" | "blade" | "chain" | "talisman" }
  | { kind: "class"; class: string }
  | { kind: "ability"; ability: "str" | "dex" | "con" | "int" | "wis" | "cha"; min: number }
  | { kind: "other"; detail: string };

export interface OptionalFeatureEntity {
  slug: string;
  name: string;
  edition: Edition;
  source: string;
  /** Open string category (e.g. "invocation"); see {@link OptionalFeatureKind} for canonical SRD values. */
  feature_type: string;
  description: string;
  prerequisites: OptionalFeaturePrerequisite[];
  /** Wikilinks to classes/subclasses that can pick this option. */
  available_to: string[];
  /** Mechanical effects mirrored on Feat — same shape. */
  effects: FeatureEffect[];
  /** Optional action economy when the option grants an active ability. */
  action_cost?: ActionCost | null;
  /** Optional uses tracker. */
  uses?: {
    max: number | string;       // string for formula (e.g. "{cha_mod}")
    recharge: ResetTrigger;
  } | null;
  /** Resource cost to use this option (e.g. burn a Seal). */
  consumes?: ResourceConsumption | null;
  /** How long the granted effect lasts (rendered as a label in Phase 2). */
  duration?: Duration | null;
  /** Always-on marker; renders a "Passive" tag. */
  passive?: boolean;
  /** Phase 3 activatable buffs: when true, the boon's effects fold only while its
   *  slug is present in `Character.state.active_buffs` (toggled in the PoolTab). */
  activatable?: boolean;
}
