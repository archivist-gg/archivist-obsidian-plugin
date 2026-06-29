import type { ResolveContext } from "@archivist/core";
import type { MonsterRaw } from "./monster.codec";
import { getProficiencyBonus, getChallengeRatingXP } from "./monster.enrichment";

/**
 * Light, non-mutating derivation: computes proficiency bonus and XP from the
 * monster's challenge rating. Returns a new object; the input `raw` is untouched.
 */
export function resolveMonster(
  raw: MonsterRaw,
  _ctx: ResolveContext,
): MonsterRaw & { proficiency_bonus: number; xp: number } {
  // `raw` is Record<string, unknown>, so narrow `cr` to a stringifiable
  // primitive rather than risk an object's "[object Object]" stringification.
  const crValue = raw.cr;
  const cr =
    typeof crValue === "string" ? crValue
    : typeof crValue === "number" ? String(crValue)
    : "0";
  return {
    ...raw,
    proficiency_bonus: getProficiencyBonus(cr),
    xp: getChallengeRatingXP(cr),
  };
}
