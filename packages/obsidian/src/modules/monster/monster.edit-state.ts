import type { Monster } from "./monster.types";
import type { Abilities } from "../../shared/types";
import { SKILL_ABILITY, STANDARD_SENSES, ABILITY_KEYS } from "../../shared/dnd/constants";
import {
  abilityModifier,
  proficiencyBonusFromCR,
  crToXP,
  savingThrow,
  skillBonus,
  passivePerception,
  hpFromHitDice,
  parseHitDiceFormula,
  hitDiceSizeFromCreatureSize,
} from "../../shared/dnd/math";
import { editableToYaml } from "./monster.yaml-serializer";

// -----------------------------------------------------------------------------
// EditableMonster type and conversion helpers (formerly src/dnd/editable-monster.ts)
// -----------------------------------------------------------------------------

export type SkillProficiency = "none" | "proficient" | "expertise";

export interface EditableMonster extends Monster {
  overrides: Set<string>;
  saveProficiencies: Record<string, boolean>;
  skillProficiencies: Record<string, SkillProficiency>;
  activeSenses: Record<string, string | null>;
  customSenses: string[];
  activeSections: string[];
  xp: number;
  proficiencyBonus: number;
}

/**
 * Convert a Monster to an EditableMonster by inferring proficiencies,
 * parsing senses, and detecting active sections.
 */
export function monsterToEditable(monster: Monster): EditableMonster {
  const cr = monster.cr ?? "0";
  const profBonus = proficiencyBonusFromCR(cr);
  const abilities = monster.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // Infer save proficiencies
  const saveProficiencies: Record<string, boolean> = {};
  for (const key of ABILITY_KEYS) {
    if (monster.saves && monster.saves[key] !== undefined) {
      saveProficiencies[key] = true;
    } else {
      saveProficiencies[key] = false;
    }
  }

  // Infer skill proficiencies
  const skillProficiencies: Record<string, SkillProficiency> = {};
  for (const [skillLower, abilityKey] of Object.entries(SKILL_ABILITY)) {
    const abilityScore = abilities[abilityKey as keyof Abilities];
    const mod = abilityModifier(abilityScore);

    // Look up skill value from monster (case-insensitive match)
    let skillValue: number | undefined;
    if (monster.skills) {
      for (const [k, v] of Object.entries(monster.skills)) {
        if (k.toLowerCase() === skillLower) {
          skillValue = v;
          break;
        }
      }
    }

    if (skillValue !== undefined) {
      if (skillValue >= mod + profBonus * 2) {
        skillProficiencies[skillLower] = "expertise";
      } else if (skillValue >= mod + profBonus) {
        skillProficiencies[skillLower] = "proficient";
      } else {
        skillProficiencies[skillLower] = "none";
      }
    } else {
      skillProficiencies[skillLower] = "none";
    }
  }

  // Parse senses
  const activeSenses: Record<string, string | null> = {};
  const customSenses: string[] = [];

  for (const sense of STANDARD_SENSES) {
    activeSenses[sense.toLowerCase()] = null;
  }

  if (monster.senses) {
    for (const senseStr of monster.senses) {
      let matched = false;
      for (const standardSense of STANDARD_SENSES) {
        const regex = new RegExp(`^${standardSense}\\s+(.+)$`, "i");
        const match = senseStr.match(regex);
        if (match) {
          activeSenses[standardSense.toLowerCase()] = match[1].trim();
          matched = true;
          break;
        }
      }
      if (!matched) {
        customSenses.push(senseStr);
      }
    }
  }

  // Detect active sections
  const activeSections: string[] = [];
  if (monster.traits && monster.traits.length > 0) activeSections.push("traits");
  if (monster.actions && monster.actions.length > 0) activeSections.push("actions");
  if (monster.reactions && monster.reactions.length > 0) activeSections.push("reactions");
  if (monster.legendary_actions && monster.legendary_actions.length > 0) activeSections.push("legendary_actions");

  // Detect overrides: compare parsed values against auto-calculated values
  const overrides = new Set<string>();

  // Detect save overrides
  if (monster.saves) {
    for (const key of ABILITY_KEYS) {
      if (monster.saves[key] !== undefined) {
        const autoValue = savingThrow(abilities[key], true, profBonus);
        if (monster.saves[key] !== autoValue) {
          overrides.add(`saves.${key}`);
        }
      }
    }
  }

  // Detect skill overrides
  if (monster.skills) {
    for (const [skillLower, profLevel] of Object.entries(skillProficiencies)) {
      if (profLevel === "none") continue;
      const abilityKey = SKILL_ABILITY[skillLower];
      if (!abilityKey) continue;
      const abilityScore = abilities[abilityKey as keyof Abilities];
      const autoValue = skillBonus(abilityScore, profLevel, profBonus);
      // Look up the actual stored value (case-insensitive)
      let storedValue: number | undefined;
      for (const [k, v] of Object.entries(monster.skills)) {
        if (k.toLowerCase() === skillLower) {
          storedValue = v;
          break;
        }
      }
      if (storedValue !== undefined && storedValue !== autoValue) {
        overrides.add(`skills.${skillLower}`);
      }
    }
  }

  return {
    ...monster,
    abilities: monster.abilities ? { ...monster.abilities } : undefined,
    hp: monster.hp ? { ...monster.hp } : undefined,
    ac: monster.ac ? monster.ac.map(a => ({ ...a, from: a.from ? [...a.from] : undefined })) : undefined,
    speed: monster.speed ? { ...monster.speed } : undefined,
    saves: monster.saves ? { ...monster.saves } : undefined,
    skills: monster.skills ? { ...monster.skills } : undefined,
    senses: monster.senses ? [...monster.senses] : undefined,
    languages: monster.languages ? [...monster.languages] : undefined,
    overrides,
    saveProficiencies,
    skillProficiencies,
    activeSenses,
    customSenses,
    activeSections,
    xp: crToXP(cr),
    proficiencyBonus: profBonus,
  };
}

/**
 * Convert an EditableMonster back to a plain Monster by recalculating
 * saves, skills, senses, and passive perception from the editable state.
 */
export function editableToMonster(editable: EditableMonster): Monster {
  const abilities = editable.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const profBonus = editable.proficiencyBonus;

  // Rebuild saves from proficiency toggles (respecting overrides)
  const saves: Record<string, number> = {};
  let hasSaves = false;
  for (const key of ABILITY_KEYS) {
    if (editable.saveProficiencies[key]) {
      if (editable.overrides.has(`saves.${key}`) && editable.saves?.[key] !== undefined) {
        saves[key] = editable.saves[key]!;
      } else {
        const score = abilities[key];
        saves[key] = savingThrow(score, true, profBonus);
      }
      hasSaves = true;
    }
  }

  // Rebuild skills from proficiency toggles (respecting overrides)
  const skills: Record<string, number> = {};
  let hasSkills = false;
  for (const [skillLower, profLevel] of Object.entries(editable.skillProficiencies)) {
    if (profLevel !== "none") {
      const abilityKey = SKILL_ABILITY[skillLower];
      if (abilityKey) {
        const score = abilities[abilityKey as keyof Abilities];
        // Capitalize skill name for the Monster format
        const skillName = skillLower
          .split(" ")
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        if (editable.overrides.has(`skills.${skillLower}`) && editable.skills?.[skillName] !== undefined) {
          skills[skillName] = editable.skills[skillName];
        } else {
          skills[skillName] = skillBonus(score, profLevel, profBonus);
        }
        hasSkills = true;
      }
    }
  }

  // Rebuild senses array
  const senses: string[] = [];
  for (const standardSense of STANDARD_SENSES) {
    const value = editable.activeSenses[standardSense.toLowerCase()];
    if (value) {
      senses.push(`${standardSense.toLowerCase()} ${value}`);
    }
  }
  for (const custom of editable.customSenses) {
    senses.push(custom);
  }

  // Recalculate passive perception
  const perceptionProf = editable.skillProficiencies["perception"] ?? "none";
  const wisScore = abilities.wis;
  const pp = passivePerception(wisScore, perceptionProf, profBonus);

  // Build the monster, omitting undefined/empty optional fields
  const monster: Monster = {
    name: editable.name,
  };

  if (editable.size) monster.size = editable.size;
  if (editable.type) monster.type = editable.type;
  if (editable.subtype) monster.subtype = editable.subtype;
  if (editable.alignment) monster.alignment = editable.alignment;
  if (editable.cr) monster.cr = editable.cr;
  if (editable.ac && editable.ac.length > 0) monster.ac = editable.ac;
  if (editable.hp) monster.hp = editable.hp;
  if (editable.speed) monster.speed = editable.speed;
  if (editable.abilities) monster.abilities = editable.abilities;
  if (hasSaves) monster.saves = saves;
  if (hasSkills) monster.skills = skills;
  if (senses.length > 0) monster.senses = senses;
  monster.passive_perception = pp;
  if (editable.languages && editable.languages.length > 0) monster.languages = editable.languages;
  if (editable.damage_vulnerabilities && editable.damage_vulnerabilities.length > 0) {
    monster.damage_vulnerabilities = editable.damage_vulnerabilities;
  }
  if (editable.damage_resistances && editable.damage_resistances.length > 0) {
    monster.damage_resistances = editable.damage_resistances;
  }
  if (editable.damage_immunities && editable.damage_immunities.length > 0) {
    monster.damage_immunities = editable.damage_immunities;
  }
  if (editable.condition_immunities && editable.condition_immunities.length > 0) {
    monster.condition_immunities = editable.condition_immunities;
  }
  const sections = editable.activeSections ?? [];
  if (sections.includes("traits") && editable.traits && editable.traits.length > 0) monster.traits = editable.traits;
  if (sections.includes("actions") && editable.actions && editable.actions.length > 0) monster.actions = editable.actions;
  if (sections.includes("reactions") && editable.reactions && editable.reactions.length > 0) monster.reactions = editable.reactions;
  if (sections.includes("legendary_actions") && editable.legendary_actions && editable.legendary_actions.length > 0) monster.legendary_actions = editable.legendary_actions;
  if (editable.legendary_action_uses !== undefined) monster.legendary_action_uses = editable.legendary_action_uses;
  if (editable.legendary_resistance !== undefined) monster.legendary_resistance = editable.legendary_resistance;
  if (editable.columns !== undefined) monster.columns = editable.columns;

  return monster;
}

// -----------------------------------------------------------------------------
// recalculate (formerly src/dnd/recalculate.ts)
// -----------------------------------------------------------------------------

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
        skills[displayName] = result.skills?.[displayName] ?? skillBonus(abilities[abilityKey as keyof Abilities], prof, profBonus);
      } else {
        skills[displayName] = skillBonus(abilities[abilityKey as keyof Abilities], prof, profBonus);
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

// -----------------------------------------------------------------------------
// MonsterEditState (formerly src/edit/edit-state.ts)
// -----------------------------------------------------------------------------

export class MonsterEditState {
  private original: Monster;
  private _current: EditableMonster;
  private _hasPendingChanges = false;
  private onChange: (state: MonsterEditState) => void;

  constructor(monster: Monster, onChange: (state: MonsterEditState) => void) {
    this.original = monster;
    this._current = monsterToEditable(monster);
    this.onChange = onChange;
  }

  get current(): EditableMonster { return this._current; }
  get hasPendingChanges(): boolean { return this._hasPendingChanges; }

  updateField(field: string, value: unknown): void {
    setNestedField(this._current, field, value);
    this._current = recalculate(this._current, field);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  toggleSaveProficiency(ability: string): void {
    this._current.saveProficiencies[ability] = !this._current.saveProficiencies[ability];
    this._current = recalculate(this._current, `saves.${ability}`);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  cycleSkillProficiency(skill: string): void {
    const current = this._current.skillProficiencies[skill] ?? "none";
    const next = current === "none" ? "proficient" : current === "proficient" ? "expertise" : "none";
    this._current.skillProficiencies[skill] = next;
    this._current = recalculate(this._current, `skills.${skill}`);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  setOverride(field: string, value: number): void {
    this._current.overrides.add(field);
    setNestedField(this._current, field, value);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  clearOverride(field: string): void {
    this._current.overrides.delete(field);
    this._current = recalculate(this._current, field);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  addSection(section: string): void {
    if (!this._current.activeSections.includes(section)) {
      this._current.activeSections.push(section);
      const key = sectionToMonsterKey(section);
      if (key && !(this._current as Record<string, unknown>)[key]) {
        (this._current as Record<string, unknown>)[key] = [];
      }
      this._hasPendingChanges = true;
      this.onChange(this);
    }
  }

  removeSection(section: string): void {
    this._current.activeSections = this._current.activeSections.filter(s => s !== section);
    // Clear the feature data so the section is not serialized on save
    if ((this._current as Record<string, unknown>)[section] !== undefined) {
      (this._current as Record<string, unknown>)[section] = [];
    }
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  addFeature(sectionKey: string): void {
    const features = (this._current as Record<string, unknown>)[sectionKey] as Array<{name: string; entries: string[]}> | undefined;
    if (features) {
      features.push({ name: "New Feature", entries: [""] });
    } else {
      (this._current as Record<string, unknown>)[sectionKey] = [{ name: "New Feature", entries: [""] }];
    }
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  removeFeature(sectionKey: string, index: number): void {
    const features = (this._current as Record<string, unknown>)[sectionKey] as Array<unknown> | undefined;
    if (features && index >= 0 && index < features.length) {
      features.splice(index, 1);
      this._hasPendingChanges = true;
      this.onChange(this);
    }
  }

  toYaml(): string {
    return editableToYaml(this._current);
  }

  toMonster(): Monster {
    return editableToMonster(this._current);
  }

  cancel(): void {
    this._current = monsterToEditable(this.original);
    this._hasPendingChanges = false;
    this.onChange(this);
  }
}

function sectionToMonsterKey(section: string): string | null {
  const map: Record<string, string> = {
    traits: "traits", actions: "actions", reactions: "reactions",
    legendary: "legendary_actions", "bonus actions": "bonus_actions",
    "legendary actions": "legendary_actions", "lair actions": "lair_actions",
    "mythic actions": "mythic_actions",
  };
  return map[section.toLowerCase()] ?? null;
}

function setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
