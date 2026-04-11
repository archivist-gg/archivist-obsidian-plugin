// src/entities/srd-tag-converter.ts

import { abilityModifier, attackBonus, saveDC } from "../dnd/math";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface ConverterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type ActionCategory =
  | "action"
  | "trait"
  | "reaction"
  | "legendary"
  | "bonus"
  | "special";

export interface ConversionContext {
  abilities: ConverterAbilities;
  profBonus: number;
  actionName: string;
  actionCategory: ActionCategory;
  spellAbility?: "int" | "wis" | "cha";
}

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

// Referenced in later tasks (6-9). Keep imports alive for the build.
void ABILITY_KEYS;
void abilityModifier;
void attackBonus;
void saveDC;

/**
 * Convert SRD plain-English descriptions (e.g. "Melee Weapon Attack: +14 to hit,
 * Hit: 21 (3d8 + 8) slashing damage") into backtick formula tags
 * (e.g. "Melee Weapon Attack: `atk:STR`, Hit: `damage:3d8+STR` slashing damage")
 * by reverse-inferring which ability mod + prof produced the static value.
 *
 * Pure. Deterministic. Never throws: wraps everything in try/catch and returns
 * the original desc on any failure.
 */
export function convertDescToTags(desc: string, ctx: ConversionContext): string {
  try {
    if (!ctx.abilities) return desc;
    return desc;
  } catch {
    return desc;
  }
}

/**
 * Scan a monster's trait list for a spellcasting ability declaration like
 * "Its spellcasting ability is Wisdom". Returns undefined for non-casters.
 */
export function detectSpellcastingAbility(
  traits: { name: string; entries: string[] }[] | undefined,
): "int" | "wis" | "cha" | undefined {
  if (!traits) return undefined;
  for (const trait of traits) {
    for (const entry of trait.entries) {
      const match = entry.match(/spellcasting ability is (intelligence|wisdom|charisma)/i);
      if (match) {
        const name = match[1].toLowerCase();
        if (name === "intelligence") return "int";
        if (name === "wisdom") return "wis";
        if (name === "charisma") return "cha";
      }
    }
  }
  return undefined;
}
