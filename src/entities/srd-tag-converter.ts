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

    const mods = computeMods(ctx.abilities);
    const dcTargets = computeDcTargets(mods, ctx.profBonus);

    let result = desc;

    // Pass 1 — DC with explicit ability word
    result = result.replace(
      /DC (\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/gi,
      (_match, n, abilityWord) => {
        const dc = Number(n);
        const abil = abilityWordToKey(abilityWord);
        if (abil && dcTargets[abil] === dc) {
          return `\`dc:${abil.toUpperCase()}\` ${abilityWord}`;
        }
        return `\`dc:${dc}\` ${abilityWord}`;
      },
    );

    return result;
  } catch {
    return desc;
  }
}

// --- Helpers ----------------------------------------------------------------

function computeMods(abilities: ConverterAbilities): Record<AbilityKey, number> {
  return {
    str: abilityModifier(abilities.str),
    dex: abilityModifier(abilities.dex),
    con: abilityModifier(abilities.con),
    int: abilityModifier(abilities.int),
    wis: abilityModifier(abilities.wis),
    cha: abilityModifier(abilities.cha),
  };
}

function computeDcTargets(
  mods: Record<AbilityKey, number>,
  profBonus: number,
): Record<AbilityKey, number> {
  return {
    str: 8 + profBonus + mods.str,
    dex: 8 + profBonus + mods.dex,
    con: 8 + profBonus + mods.con,
    int: 8 + profBonus + mods.int,
    wis: 8 + profBonus + mods.wis,
    cha: 8 + profBonus + mods.cha,
  };
}

function abilityWordToKey(word: string): AbilityKey | undefined {
  const lower = word.toLowerCase();
  switch (lower) {
    case "strength": return "str";
    case "dexterity": return "dex";
    case "constitution": return "con";
    case "intelligence": return "int";
    case "wisdom": return "wis";
    case "charisma": return "cha";
  }
  return undefined;
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
