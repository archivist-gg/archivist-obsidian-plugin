// src/modules/item/item.conditions.ts
//
// Presentation-only remnant (3C-R Phase 1): condition → display text. The
// mechanical evaluators (evaluateCondition / evaluateConditions, plus the
// private unwrapSlug helper) were relocated to
// @archivist/dnd5e/item/item.conditions; only the human-facing formatters
// stay here in the renderer.

import type { Condition } from "@archivist/dnd5e/types/item-conditions.types";

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export function conditionToText(cond: Condition): string {
  switch (cond.kind) {
    case "no_armor":            return "no armor";
    case "no_shield":           return "no shield";
    case "wielding_two_handed": return "wielding two-handed";
    case "is_class":            return `if ${capitalize(cond.value)}`;
    case "is_race":             return `if ${capitalize(cond.value)}`;
    case "is_subclass":         return `if ${capitalize(cond.value)}`;
    case "vs_creature_type":    return `vs ${cond.value}`;
    case "vs_attack_type":      return `vs ${cond.value} attacks`;
    case "on_attack_type":      return `on ${cond.value} attacks`;
    case "with_weapon_property":return `with ${cond.value}`;
    case "vs_spell_save":       return "vs spells";
    case "lighting":            return `in ${cond.value} light`;
    case "underwater":          return "underwater";
    case "movement_state":      return `while ${cond.value}`;
    case "has_condition":       return `while ${cond.value}`;
    case "is_concentrating":    return "while concentrating";
    case "bloodied":            return "while bloodied";
    case "raw":                 return cond.text;
    case "any_of":
      return "(" + cond.conditions.map(conditionToText).join(" or ") + ")";
  }
}

export function conditionsToText(conds: Condition[]): string {
  return conds.map(conditionToText).join(" and ");
}
