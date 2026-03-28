import { getChallengeRatingXP, getProficiencyBonus } from "./cr-xp-mapping";
import { abilityModifier } from "../../parsers/yaml-utils";
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

  return {
    ...(raw as unknown as Monster),
    cr,
    xp: getChallengeRatingXP(cr),
    proficiency_bonus: getProficiencyBonus(cr),
    passive_perception: passivePerception,
    languages,
  } as Monster & { xp?: number; proficiency_bonus?: number };
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
