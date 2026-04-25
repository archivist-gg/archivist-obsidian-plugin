// src/shared/dnd/formula-tags.ts

import type { FormulaRef } from "../rendering/inline-tag-parser";
import type { Abilities } from "../types/abilities";
import { abilityModifier, formatModifier } from "./math";
import {
  CanonicalTagType,
  normalizeTagType,
  parseTagTerms,
  ABILITIES,
} from "./tag-grammar";

export type { CanonicalTagType };
export { normalizeTagType, parseTagTerms };

export interface FormulaContext {
  abilities: Abilities;
  proficiencyBonus: number;
}

export interface ResolvedTag {
  display: string;
  value?: number;
  rollable: boolean;
}

export function resolveTag(
  tagType: string,
  content: string,
  ctx: FormulaContext,
): ResolvedTag {
  const canonical = normalizeTagType(tagType);
  if (!canonical) return { display: content, rollable: false };

  const parsed = parseTagTerms(content);
  if ("error" in parsed) {
    if (typeof console !== "undefined") {
      console.warn(`tag parse error for ${canonical}:${content} — ${parsed.error}`);
    }
    return { display: content, rollable: false };
  }

  // Validate per-tag PB rules.
  if (canonical === "dc" && parsed.pbTerm) {
    if (typeof console !== "undefined") {
      console.warn(`dc:${content} — explicit +PB is redundant; dc tags always include PB`);
    }
    return { display: content, rollable: false };
  }
  if (canonical === "dmg" && parsed.pbTerm) {
    if (typeof console !== "undefined") {
      console.warn(`dmg:${content} — PB not applicable to damage`);
    }
    return { display: content, rollable: false };
  }
  if (canonical === "dice" && (parsed.abilityTerm || parsed.pbTerm)) {
    if (typeof console !== "undefined") {
      console.warn(`dice:${content} — abilities/PB not allowed in dice tags`);
    }
    return { display: content, rollable: false };
  }

  const abilityMod = parsed.abilityTerm
    ? abilityModifier(ctx.abilities[parsed.abilityTerm])
    : 0;
  const literalSum = parsed.literalTerms.reduce((a, b) => a + b, 0);

  switch (canonical) {
    case "atk": {
      const value = abilityMod + (parsed.pbTerm ? ctx.proficiencyBonus : 0) + literalSum;
      return { display: formatModifier(value), value, rollable: true };
    }
    case "dc": {
      // PB always implicit on DC tags. If no ability term, treat the literal as the DC.
      if (!parsed.abilityTerm && parsed.literalTerms.length === 1 && parsed.literalTerms[0] >= 0) {
        return { display: `DC ${parsed.literalTerms[0]}`, value: parsed.literalTerms[0], rollable: false };
      }
      const value = 8 + ctx.proficiencyBonus + abilityMod + literalSum;
      return { display: `DC ${value}`, value, rollable: false };
    }
    case "dmg": {
      const dicePart = parsed.diceTerms.map((d) => `${d.count}d${d.sides}`).join("+");
      const modPart = abilityMod + literalSum;
      let display = dicePart;
      if (modPart !== 0) display += modPart >= 0 ? `+${modPart}` : `${modPart}`;
      if (display === "") display = String(modPart);
      return { display, rollable: true };
    }
    case "dice": {
      const dicePart = parsed.diceTerms.map((d) => `${d.count}d${d.sides}`).join("+");
      return { display: dicePart || content, rollable: true };
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Backward-compatible helpers retained because legacy callers depend on
// detectFormula() and resolveFormulaTag(). They delegate to resolveTag().
// ──────────────────────────────────────────────────────────────────────────

const ABILITY_PATTERN = /\b(str|dex|con|int|wis|cha)\b/i;

/** @deprecated use parseTagTerms directly */
export function detectFormula(tagType: string, content: string): FormulaRef | null {
  const canonical = normalizeTagType(tagType);
  if (!canonical || canonical === "dice") return null;
  const match = content.match(ABILITY_PATTERN);
  if (!match) return null;
  const ability = match[1].toLowerCase();
  if (!ABILITIES.includes(ability as never)) return null;
  const kind = canonical === "atk" ? "attack" : canonical === "dc" ? "dc" : "damage";
  return { ability, kind };
}

/** @deprecated use resolveTag */
export function resolveFormulaTag(
  tagType: string,
  content: string,
  abilities: Abilities,
  profBonus: number,
): string {
  const r = resolveTag(tagType, content, { abilities, proficiencyBonus: profBonus });
  return r.display;
}
