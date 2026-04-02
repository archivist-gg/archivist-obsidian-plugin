import type { EditableMonster } from "./editable-monster";
import type { MonsterAbilities } from "../types/monster";
import { SKILL_ABILITY, ABILITY_KEYS } from "./constants";
import {
  abilityModifier, proficiencyBonusFromCR, crToXP, savingThrow,
  skillBonus, passivePerception, hpFromHitDice, parseHitDiceFormula,
  hitDiceSizeFromCreatureSize,
} from "./math";

export function recalculate(monster: EditableMonster, changedField: string): EditableMonster {
  const result = { ...monster };
  const abilities = result.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // CR change -> update proficiency bonus and XP
  if (changedField === "cr") {
    result.proficiencyBonus = proficiencyBonusFromCR(result.cr ?? "0");
    if (!result.overrides.has("xp")) {
      result.xp = crToXP(result.cr ?? "0");
    }
  }
  const profBonus = result.proficiencyBonus;

  // Size change -> update hit dice size in formula
  if (changedField === "size" && result.hp?.formula) {
    const parsed = parseHitDiceFormula(result.hp.formula);
    if (parsed) {
      const newSize = hitDiceSizeFromCreatureSize(result.size ?? "medium");
      result.hp = { ...result.hp, formula: `${parsed.count}d${newSize}` };
    }
  }

  // Recalculate HP from hit dice + CON mod
  if (!result.overrides.has("hp") && result.hp?.formula) {
    const parsed = parseHitDiceFormula(result.hp.formula);
    if (parsed) {
      const conMod = abilityModifier(abilities.con);
      result.hp = { ...result.hp, average: hpFromHitDice(parsed.count, parsed.size, conMod) };
    }
  }

  // Recalculate saves
  const saves: Record<string, number> = {};
  let hasSaves = false;
  for (const key of ABILITY_KEYS) {
    if (result.saveProficiencies[key]) {
      if (result.overrides.has(`saves.${key}`)) {
        saves[key] = result.saves?.[key] ?? savingThrow(abilities[key], true, profBonus);
      } else {
        saves[key] = savingThrow(abilities[key], true, profBonus);
      }
      hasSaves = true;
    }
  }
  result.saves = hasSaves ? saves : undefined;

  // Recalculate skills
  const skills: Record<string, number> = {};
  let hasSkills = false;
  for (const [skillName, abilityKey] of Object.entries(SKILL_ABILITY)) {
    const prof = result.skillProficiencies[skillName];
    if (prof && prof !== "none") {
      const displayName = skillName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      if (result.overrides.has(`skills.${skillName}`)) {
        skills[displayName] = result.skills?.[displayName] ?? skillBonus(abilities[abilityKey as keyof MonsterAbilities], prof, profBonus);
      } else {
        skills[displayName] = skillBonus(abilities[abilityKey as keyof MonsterAbilities], prof, profBonus);
      }
      hasSkills = true;
    }
  }
  result.skills = hasSkills ? skills : undefined;

  // Recalculate passive perception
  if (!result.overrides.has("passive_perception")) {
    const percProf = result.skillProficiencies["perception"] ?? "none";
    result.passive_perception = passivePerception(abilities.wis, percProf, profBonus);
  }

  return result;
}
