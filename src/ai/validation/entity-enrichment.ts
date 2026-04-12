import { getChallengeRatingXP, getProficiencyBonus } from "./cr-xp-mapping";
import { abilityModifier } from "../../parsers/yaml-utils";
import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ActionCategory,
  type ConverterAbilities,
} from "../../entities/srd-tag-converter";
import type { Monster } from "../../types/monster";
import type { Spell } from "../../types/spell";
import type { Item } from "../../types/item";

export function enrichMonster(
  raw: Record<string, unknown>,
): Monster & { xp?: number; proficiency_bonus?: number } {
  const cr = String(raw.cr ?? "0");
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

function convertMonsterEntries(
  monster: Monster & Record<string, unknown>,
  cr: string,
): void {
  const abilities = monster.abilities;
  if (!abilities) return;

  const profBonus = getProficiencyBonus(cr);
  const spellAbility = detectSpellcastingAbility(
    monster.traits as { name: string; entries: string[] }[] | undefined,
  );

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
          abilities: abilities as ConverterAbilities,
          profBonus,
          actionName: f.name ?? "",
          actionCategory: category,
          spellAbility,
        });
      });
    }
  }
}

export function enrichSpell(raw: Record<string, unknown>): Spell {
  const duration = raw.duration as string | undefined;
  const concentration =
    (raw.concentration as boolean) ??
    (duration?.toLowerCase().includes("concentration") ?? false);
  const classes = (raw.classes as string[])?.length
    ? (raw.classes as string[])
    : ["Wizard", "Sorcerer"];

  return {
    ...(raw as unknown as Spell),
    concentration,
    ritual: (raw.ritual as boolean) ?? false,
    classes,
  };
}

export function enrichItem(
  raw: Record<string, unknown>,
): Item & { source?: string } {
  return {
    ...(raw as unknown as Item),
    source: (raw.source as string) ?? "Homebrew",
    attunement: raw.attunement ?? false,
    curse: (raw.curse as boolean) ?? false,
  } as Item & { source?: string };
}
