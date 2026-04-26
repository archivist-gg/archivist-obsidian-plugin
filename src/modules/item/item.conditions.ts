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
