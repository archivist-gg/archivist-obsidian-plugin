import type { Ability } from "@archivist/dnd5e/types/choice";
import type { AbilityMethod } from "../../pc.types";
import { ABILITY_KEYS } from "@archivist/dnd5e/dnd/constants";

/** SP2 §7 Step 3 — the ability-score method registry. */
export interface AbilityMethodDef {
  id: AbilityMethod;
  label: string;
  homebrew?: boolean;
}

/** Array order = tab display order. */
export const ABILITY_METHODS: readonly AbilityMethodDef[] = [
  { id: "standard-array", label: "Standard Array" },
  { id: "point-buy", label: "Standard Point Buy" },
  { id: "archivist-point-buy", label: "Archivist Point Buy", homebrew: true },
  { id: "manual", label: "Manual" },
  { id: "rolled", label: "Roll" },
];

export const STANDARD_ARRAY: readonly number[] = [15, 14, 13, 12, 10, 8];

export interface PointBuyRule {
  budget: number;
  min: number;
  max: number;
  /** Cost per final base score. Negative = refund (Archivist dump-stat credit). */
  cost: Record<number, number>;
}

/** Absent for non-point-buy methods; callers must guard. */
export const POINT_BUY_RULES: Partial<Record<AbilityMethod, PointBuyRule>> = {
  "point-buy": {
    budget: 27, min: 8, max: 15,
    cost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
  },
  // Archivist homebrew: 28 points, 7-16; a 7 refunds a point.
  "archivist-point-buy": {
    budget: 28, min: 7, max: 16,
    cost: { 7: -1, 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9, 16: 11 },
  },
};

function clampScore(rule: PointBuyRule, v: number): number {
  return Math.min(rule.max, Math.max(rule.min, v));
}

export function pointBuySpent(rule: PointBuyRule, abilities: Record<Ability, number>): number {
  let spent = 0;
  for (const ab of ABILITY_KEYS) spent += rule.cost[clampScore(rule, abilities[ab] ?? rule.min)] ?? 0;
  return spent;
}

export function pointBuyRemaining(rule: PointBuyRule, abilities: Record<Ability, number>): number {
  return rule.budget - pointBuySpent(rule, abilities);
}

/** Values this ability may take given every OTHER ability stays fixed. */
export function allowedScores(
  rule: PointBuyRule,
  abilities: Record<Ability, number>,
  ability: Ability,
): number[] {
  const others = pointBuySpent(rule, abilities) - (rule.cost[clampScore(rule, abilities[ability] ?? rule.min)] ?? 0);
  const out: number[] = [];
  for (let v = rule.min; v <= rule.max; v++) {
    if (others + (rule.cost[v] ?? 0) <= rule.budget) out.push(v);
  }
  return out;
}
