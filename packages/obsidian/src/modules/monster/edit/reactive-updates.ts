import type { Abilities } from "../../../shared/types";
import type { MonsterEditState } from "../monster.edit-state";
import { ABILITY_KEYS, ALL_SKILLS, SKILL_ABILITY } from "../../../shared/dnd/constants";
import {
  abilityModifier, formatModifier,
  savingThrow, skillBonus, passivePerception,
} from "../../../shared/dnd/math";
import {
  type DomRefs,
  flashUpdate,
  formatXP,
  updateSaveToggle,
  updateSkillToggle,
} from "./types";

/**
 * Reactive DOM updates applied whenever the edit-state notifies a
 * change. Refreshes HP, XP, ability modifiers, save/skill values +
 * toggles, and passive perception — every other field already stays
 * in sync through the `input` events that drove the state change.
 */
export function updateDom(state: MonsterEditState, refs: DomRefs): void {
  const m = state.current;
  const abilities = m.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const profBonus = m.proficiencyBonus;

  if (refs.hpValue) {
    flashUpdate(refs.hpValue, String(m.hp?.average ?? 0));
  }

  if (refs.xpValue) {
    flashUpdate(refs.xpValue, formatXP(m.xp));
  }

  for (const key of ABILITY_KEYS) {
    if (refs.abilityModCells[key]) {
      const score = abilities[key];
      refs.abilityModCells[key].textContent = `(${formatModifier(abilityModifier(score))})`;
    }
  }

  for (const key of ABILITY_KEYS) {
    if (refs.saveValues[key]) {
      if (!m.overrides.has(`saves.${key}`)) {
        const score = abilities[key];
        const sv = savingThrow(score, m.saveProficiencies[key], profBonus);
        flashUpdate(refs.saveValues[key], formatModifier(sv));
      }
      if (m.saveProficiencies[key]) {
        refs.saveValues[key].addClass("proficient-value");
      } else {
        refs.saveValues[key].removeClass("proficient-value");
      }
    }
    if (refs.saveToggles[key]) {
      updateSaveToggle(refs.saveToggles[key], m.saveProficiencies[key]);
    }
  }

  for (const skill of ALL_SKILLS) {
    const skillLower = skill.toLowerCase();
    const abilityKey = SKILL_ABILITY[skillLower] as keyof Abilities;
    if (refs.skillValues[skillLower]) {
      if (!m.overrides.has(`skills.${skillLower}`)) {
        const score = abilities[abilityKey];
        const prof = m.skillProficiencies[skillLower] ?? "none";
        const bonus = skillBonus(score, prof, profBonus);
        flashUpdate(refs.skillValues[skillLower], formatModifier(bonus));
      }
      const prof = m.skillProficiencies[skillLower] ?? "none";
      if (prof !== "none") {
        refs.skillValues[skillLower].addClass("proficient-value");
      } else {
        refs.skillValues[skillLower].removeClass("proficient-value");
      }
    }
    if (refs.skillToggles[skillLower]) {
      updateSkillToggle(refs.skillToggles[skillLower], m.skillProficiencies[skillLower] ?? "none");
    }
  }

  if (refs.sensePPValue) {
    const wisScore = abilities.wis;
    const percProf = m.skillProficiencies["perception"] ?? "none";
    flashUpdate(refs.sensePPValue, String(passivePerception(wisScore, percProf, profBonus)));
    if (percProf !== "none") {
      refs.sensePPValue.addClass("proficient-value");
    } else {
      refs.sensePPValue.removeClass("proficient-value");
    }
  }
}
