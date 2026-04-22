import { abilityModifier } from "../../shared/dnd/math";
import { toStringSafe } from "../../shared/parsers/yaml-utils";
import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ActionCategory,
} from "../../shared/dnd/srd-tag-converter";
import type { Monster } from "./monster.types";

// -----------------------------------------------------------------------------
// CR / XP / proficiency-bonus tables (formerly src/ai/validation/cr-xp-mapping.ts)
// -----------------------------------------------------------------------------

export const CR_TO_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};

export function parseCR(cr: string): number {
  if (!cr) return 0;
  if (cr.includes("/")) {
    const [num, denom] = cr.split("/").map(Number);
    return num / denom;
  }
  return Number(cr) || 0;
}

export function getChallengeRatingXP(cr: string): number {
  return CR_TO_XP[cr] ?? 0;
}

export function getProficiencyBonus(cr: string): number {
  const v = parseCR(cr);
  if (v < 5) return 2;
  if (v < 9) return 3;
  if (v < 13) return 4;
  if (v < 17) return 5;
  if (v < 21) return 6;
  if (v < 25) return 7;
  if (v < 29) return 8;
  return 9;
}

// -----------------------------------------------------------------------------
// Monster enrichment (formerly the monster-specific portion of
// src/ai/validation/entity-enrichment.ts)
// -----------------------------------------------------------------------------

export function enrichMonster(
  raw: Record<string, unknown>,
): Monster & { xp?: number; proficiency_bonus?: number } {
  const cr = toStringSafe(raw.cr ?? "0");
  const abilities = raw.abilities as Monster["abilities"];
  const wisdomMod = abilities ? abilityModifier(abilities.wis) : 0;
  const passivePerception =
    (raw.passive_perception as number) ?? (10 + wisdomMod);
  const languages = (raw.languages as string[])?.length
    ? (raw.languages as string[])
    : ["---"];

  const enriched = {
    ...(raw as unknown as Monster),
    cr,
    xp: getChallengeRatingXP(cr),
    proficiency_bonus: getProficiencyBonus(cr),
    passive_perception: passivePerception,
    languages,
  } as Monster & { xp?: number; proficiency_bonus?: number };

  // Safety net: convert any plain-English mechanics to backtick formula tags
  convertMonsterEntries(enriched, cr);

  return enriched;
}

const MONSTER_SECTIONS: [keyof Monster, ActionCategory][] = [
  ["traits", "trait"],
  ["actions", "action"],
  ["reactions", "reaction"],
  ["legendary", "legendary"],
];

export function convertMonsterEntries(
  monster: Monster & Record<string, unknown>,
  cr: string,
): void {
  const abilities = monster.abilities;
  if (!abilities) return;

  const profBonus = getProficiencyBonus(cr);
  const spellAbility = detectSpellcastingAbility(monster.traits);

  for (const [key, category] of MONSTER_SECTIONS) {
    const features = monster[key];
    if (!Array.isArray(features)) continue;
    for (const feature of features) {
      const f = feature as { name?: string; entries?: string[] };
      if (!Array.isArray(f.entries)) continue;
      f.entries = f.entries.map((desc: string) => {
        // Skip entries that already use 5etools tags — those are handled at render time
        if (/\{@\w+/.test(desc)) return desc;
        return convertDescToTags(desc, {
          abilities,
          profBonus,
          actionName: f.name ?? "",
          actionCategory: category,
          spellAbility,
        });
      });
    }
  }
}
