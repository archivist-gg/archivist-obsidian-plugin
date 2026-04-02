import { CR_PROFICIENCY, CR_XP, SIZE_HIT_DICE, ABILITY_KEYS } from "./constants";

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonusFromCR(cr: string): number {
  return CR_PROFICIENCY[cr] ?? 2;
}

export function crToXP(cr: string): number {
  return CR_XP[cr] ?? 0;
}

export function hitDiceSizeFromCreatureSize(size: string): number {
  return SIZE_HIT_DICE[size.toLowerCase()] ?? 8;
}

export function hpFromHitDice(hitDiceCount: number, hitDiceSize: number, conMod: number): number {
  const avg = Math.floor(hitDiceCount * (hitDiceSize + 1) / 2 + hitDiceCount * conMod);
  return Math.max(1, avg);
}

export function parseHitDiceFormula(formula: string): { count: number; size: number } | null {
  const match = formula.match(/^(\d+)d(\d+)/i);
  if (!match) return null;
  return { count: parseInt(match[1], 10), size: parseInt(match[2], 10) };
}

export function savingThrow(abilityScore: number, isProficient: boolean, profBonus: number): number {
  return abilityModifier(abilityScore) + (isProficient ? profBonus : 0);
}

export function skillBonus(abilityScore: number, proficiency: "none" | "proficient" | "expertise", profBonus: number): number {
  const mod = abilityModifier(abilityScore);
  if (proficiency === "expertise") return mod + profBonus * 2;
  if (proficiency === "proficient") return mod + profBonus;
  return mod;
}

export function passivePerception(wisScore: number, perceptionProf: "none" | "proficient" | "expertise", profBonus: number): number {
  return 10 + skillBonus(wisScore, perceptionProf, profBonus);
}

export function attackBonus(abilityScore: number, profBonus: number): number {
  return abilityModifier(abilityScore) + profBonus;
}

export function saveDC(abilityScore: number, profBonus: number): number {
  return 8 + profBonus + abilityModifier(abilityScore);
}

export function abilityNameToKey(name: string): (typeof ABILITY_KEYS)[number] | null {
  const lower = name.toLowerCase();
  if ((ABILITY_KEYS as readonly string[]).includes(lower)) {
    return lower as (typeof ABILITY_KEYS)[number];
  }
  return null;
}
