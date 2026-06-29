// packages/dnd5e/src/types/item-conditions.types.ts
//
// Pure D&D 5e conditional-bonus grammar: the Condition discriminated union,
// the ConditionalBonus wrapper, and the BonusFieldPath addresses a bonus may
// target. Relocated out of the obsidian item module so the build-time SRD
// merger can consume it without a tools→obsidian reverse edge. The PC-coupled
// shapes (ConditionContext, InformationalBonus, BonusReadResult) stay in
// obsidian's `item.conditions.types`, which re-exports this grammar.

import type { Ability } from "./choice";

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
