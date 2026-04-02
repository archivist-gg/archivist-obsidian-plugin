import type { FormulaRef } from "../parsers/inline-tag-parser";
import type { MonsterAbilities } from "../types/monster";
import { abilityModifier, attackBonus, saveDC, formatModifier } from "./math";
import { ABILITY_KEYS } from "./constants";

const ABILITY_PATTERN = /\b(STR|DEX|CON|INT|WIS|CHA)\b/i;

export function detectFormula(tagType: string, content: string): FormulaRef | null {
  if (tagType !== "atk" && tagType !== "damage" && tagType !== "dc") return null;
  const match = content.match(ABILITY_PATTERN);
  if (!match) return null;
  const ability = match[1].toLowerCase();
  if (!(ABILITY_KEYS as readonly string[]).includes(ability)) return null;
  const kind = tagType === "atk" ? "attack" : tagType === "dc" ? "dc" : "damage";
  return { ability, kind };
}

export function resolveFormulaTag(tagType: string, content: string, abilities: MonsterAbilities, profBonus: number): string {
  const formula = detectFormula(tagType, content);
  if (!formula) return content;
  const abilityScore = abilities[formula.ability as keyof MonsterAbilities];
  switch (formula.kind) {
    case "attack": return formatModifier(attackBonus(abilityScore, profBonus));
    case "dc": return `DC ${saveDC(abilityScore, profBonus)}`;
    case "damage": {
      const mod = abilityModifier(abilityScore);
      return content.replace(ABILITY_PATTERN, mod >= 0 ? `+${mod}` : `${mod}`)
        .replace(/\+\+/g, "+").replace(/\+-/g, "-");
    }
    default: return content;
  }
}
