import type { FeatureEffect, ActionCost, ResetTrigger } from "../../shared/types";
import type { Edition } from "../class/class.types";

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
  feature_type: OptionalFeatureKind;
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
}
