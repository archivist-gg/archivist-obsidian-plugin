// src/modules/item/item.conditions.types.ts
//
// Type-only module: condition discriminated union and the supporting shapes
// used by the evaluator, accessor, and renderer. No runtime exports here.

import type { Ability } from "../../shared/types";
import type { EquippedSlots, ClassEntry } from "../pc/pc.types";

// --------------------------------------------------------------------------
// Condition - discriminated union, recursive via any_of.
// --------------------------------------------------------------------------

export type Tier1Condition =
  | { kind: "no_armor" }
  | { kind: "no_shield" }
  | { kind: "wielding_two_handed" }
  | { kind: "is_class"; value: string }
  | { kind: "is_race"; value: string }
  | { kind: "is_subclass"; value: string };

export type Tier2Condition =
  | { kind: "vs_creature_type"; value: string }
  | { kind: "vs_attack_type"; value: "ranged" | "melee" }
  | { kind: "on_attack_type"; value: "ranged" | "melee" }
  | { kind: "with_weapon_property"; value: string }
  | { kind: "vs_spell_save" };

export type Tier3Condition =
  | { kind: "lighting"; value: "dim" | "bright" | "daylight" | "darkness" }
  | { kind: "underwater" }
  | { kind: "movement_state"; value: "flying" | "swimming" | "climbing" | "mounted" };

export type Tier4Condition =
  | { kind: "has_condition"; value: string }
  | { kind: "is_concentrating" }
  | { kind: "bloodied" };

export type FreeTextCondition = { kind: "raw"; text: string };

export type AnyOfCondition = { kind: "any_of"; conditions: Condition[] };

export type Condition =
  | Tier1Condition
  | Tier2Condition
  | Tier3Condition
  | Tier4Condition
  | FreeTextCondition
  | AnyOfCondition;

// --------------------------------------------------------------------------
// ConditionalBonus - wraps a numeric bonus value with an AND-list of conds.
// --------------------------------------------------------------------------

export interface ConditionalBonus {
  value: number;
  when: Condition[];
}

// --------------------------------------------------------------------------
// Field paths that may carry a ConditionalBonus.
// --------------------------------------------------------------------------

export type BonusFieldPath =
  | "ac"
  | "saving_throws"
  | "spell_attack"
  | "spell_save_dc"
  | "weapon_attack"
  | "weapon_damage"
  | `ability_scores.bonus.${Ability}`
  | "speed.walk"
  | "speed.fly"
  | "speed.swim"
  | "speed.climb";

// --------------------------------------------------------------------------
// Informational record carried through derived state to UI tooltips.
// --------------------------------------------------------------------------

export interface InformationalBonus {
  field: BonusFieldPath;
  source: string;
  value: number;
  conditions: Condition[];
}

// --------------------------------------------------------------------------
// Evaluator interface.
// --------------------------------------------------------------------------

export type ConditionOutcome = "true" | "false" | "informational";

export interface ConditionContext {
  derived: { equippedSlots: EquippedSlots };
  classList: ClassEntry[];
  race: string | null;
  subclasses: string[];
}

// --------------------------------------------------------------------------
// readNumericBonus return shape.
// --------------------------------------------------------------------------

export type BonusReadResult =
  | { kind: "applied"; value: number }
  | { kind: "skipped" }
  | { kind: "informational"; value: number; conditions: Condition[] };
