// src/modules/item/item.conditions.ts
//
// Single switch over Condition.kind. Tier 1 evaluates against character
// state; Tiers 2-4 + raw always return "informational" until their
// respective evaluators land. any_of recurses.

import type {
  Condition,
  ConditionContext,
  ConditionOutcome,
} from "./item.conditions.types";

function unwrapSlug(maybeWiki: string | null | undefined): string {
  if (!maybeWiki) return "";
  const m = /^\[\[([^\]]+)\]\]$/.exec(maybeWiki);
  return (m ? m[1] : maybeWiki).toLowerCase();
}

export function evaluateCondition(
  cond: Condition,
  ctx: ConditionContext,
): ConditionOutcome {
  switch (cond.kind) {
    case "no_armor":
      return ctx.derived.equippedSlots.armor === undefined ? "true" : "false";
    case "no_shield":
      return ctx.derived.equippedSlots.shield === undefined ? "true" : "false";
    case "wielding_two_handed": {
      const main = ctx.derived.equippedSlots.mainhand?.entity;
      if (!main || typeof main !== "object" || !("properties" in main)) return "false";
      const props = (main as { properties?: unknown }).properties;
      if (!Array.isArray(props)) return "false";
      return props.some((p) => p === "two_handed") ? "true" : "false";
    }
    case "is_class": {
      const target = cond.value.toLowerCase();
      return ctx.classList.some((c) => unwrapSlug(c.name) === target) ? "true" : "false";
    }
    case "is_race":
      return unwrapSlug(ctx.race) === cond.value.toLowerCase() ? "true" : "false";
    case "is_subclass":
      return ctx.subclasses.some((s) => s.toLowerCase() === cond.value.toLowerCase())
        ? "true"
        : "false";

    // Tier 2-4 - always informational in v1.
    case "vs_creature_type":
    case "vs_attack_type":
    case "on_attack_type":
    case "with_weapon_property":
    case "vs_spell_save":
    case "lighting":
    case "underwater":
    case "movement_state":
    case "has_condition":
    case "is_concentrating":
    case "bloodied":
      return "informational";

    case "raw":
      return "informational";

    case "any_of": {
      let sawInformational = false;
      for (const branch of cond.conditions) {
        const o = evaluateCondition(branch, ctx);
        if (o === "true") return "true";
        if (o === "informational") sawInformational = true;
      }
      return sawInformational ? "informational" : "false";
    }
  }
}

/**
 * AND-combine a list of conditions.
 * - Empty list -> "true" (always-applies; matches flat-number semantics).
 * - Any "false" -> "false" (engine certainty short-circuits informational).
 * - Else any "informational" -> "informational".
 * - Else "true".
 */
export function evaluateConditions(
  conds: Condition[],
  ctx: ConditionContext,
): ConditionOutcome {
  let sawInformational = false;
  for (const c of conds) {
    const o = evaluateCondition(c, ctx);
    if (o === "false") return "false";
    if (o === "informational") sawInformational = true;
  }
  return sawInformational ? "informational" : "true";
}

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
