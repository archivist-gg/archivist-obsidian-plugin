import type { Feature } from "../../shared/types";
import type { Edition } from "../class/class.types";

export type OptionalFeatureKind =
  | "invocation"        // warlock eldritch invocations
  | "fighting_style"    // fighter / paladin / ranger
  | "metamagic"         // sorcerer
  | "maneuver"          // battle master (non-SRD; future)
  | "infusion";         // artificer (non-SRD; future)

export interface OptionalFeaturePrerequisite {
  kind: "level" | "spell-known" | "pact" | "class" | "ability" | "other";
  /** Free-form text for "other"; structured fields per kind for the rest. */
  detail?: string;
  /** For "level" / "ability": the minimum value. */
  min?: number;
  /** For "spell-known": the spell wikilink. */
  spell?: string;
  /** For "pact": "tome" | "blade" | "chain" | "talisman". */
  pact?: string;
  /** For "class": the class wikilink. */
  class?: string;
  /** For "ability": str | dex | con | int | wis | cha. */
  ability?: "str" | "dex" | "con" | "int" | "wis" | "cha";
}

export interface OptionalFeatureEntity {
  slug: string;
  name: string;
  edition: Edition;            // "2014" | "2024"
  source: string;
  feature_type: OptionalFeatureKind;
  description: string;
  prerequisites: OptionalFeaturePrerequisite[];
  /** Wikilinks to classes/subclasses that can pick this option. */
  available_to: string[];
  /** Mechanical effects mirrored on Feat — same shape. */
  effects: Feature["effects"];
  /** Optional action economy when the option grants an active ability. */
  action_cost?: "action" | "bonus_action" | "reaction" | "free" | "special" | null;
  /** Optional uses tracker. */
  uses?: {
    max: number | string;       // string for formula (e.g. "{cha_mod}")
    recharge: "short_rest" | "long_rest" | "dawn" | "special";
  } | null;
}
