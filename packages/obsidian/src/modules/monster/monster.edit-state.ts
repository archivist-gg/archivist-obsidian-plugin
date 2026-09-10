import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import type { Abilities } from "@archivist-gg/dnd5e";
import { SKILL_ABILITY, STANDARD_SENSES, ABILITY_KEYS } from "@archivist-gg/dnd5e/dnd/constants";
import {
  abilityModifier,
  proficiencyBonusFromCR,
  savingThrow,
  skillBonus,
  passivePerception,
  hpFromHitDice,
  parseHitDiceFormula,
  hitDiceSizeFromCreatureSize,
} from "@archivist-gg/dnd5e/dnd/math";
import { crString, formatCR, sizeWord } from "@archivist-gg/dnd5e/monster/monster.format";
import { editableToYaml } from "./monster.yaml-serializer";
// The VALUE, so the deep copy below can never drift from the add-section dropdown's own vocabulary. `edit/types`
// only back-references this module with an `import type`, so there is no runtime cycle.
import { SECTION_KEY_MAP } from "./edit/types";

// -----------------------------------------------------------------------------
// EditableMonster type and conversion helpers (formerly src/dnd/editable-monster.ts)
// -----------------------------------------------------------------------------

export type SkillProficiency = "none" | "proficient" | "expertise";

/**
 * R4-G6 §9 · the keys the editors OWN: `editableToMonster` writes each of these from the edit state, over the
 * unmanaged keys it copies first. Every other authored key (`spellcasting`, `raw`, `gear`, the taxonomy tags,
 * `lair_actions`, `mythic`, `section_headers`, ...) is unmanaged: its VALUE reaches the save unchanged (invariant
 * 7). One structural qualifier since R4-G6b §4.4: the seven section arrays `SECTION_KEY_MAP` names (`traits`,
 * `actions`, `reactions`, `bonus_actions`, `legendary_actions`, `lair_actions`, `mythic_actions`) are rebuilt
 * element by element in `monsterToEditable`, where a plain-object entry becomes a shallow copy and every other
 * entry (a scalar, `null`, a nested array, and since R4-G7 §7.4 a `Date` or any other non-plain object) rides by
 * reference; every key outside those seven still rides the `...monster` spread by reference, untouched. Since
 * R4-G7 §7.4 (a) a section key whose WHOLE VALUE is not an array is the one key that rides neither: it is deleted
 * from the editable so no reader can mistake it for a feature array, and `editableToMonster` re-emits it from
 * `extras`, so invariant 7 still holds for it byte for byte.
 */
const MANAGED = new Set(["name","size","type","subtype","alignment","cr","ac","hp","speed","abilities","saves","skills","senses","passive_perception","languages","damage_vulnerabilities","damage_resistances","damage_immunities","condition_immunities","traits","actions","bonus_actions","reactions","legendary_actions","legendary_action_uses","legendary_resistance","columns"]);

/**
 * R4-G6 §9 · `EditableMonster`'s OWN fields, which are edit-state bookkeeping and NEVER reach the saved note.
 * `xp` and `proficiencyBonus` are derived from `cr` for display; an AI-path authored top-level `xp` lives in
 * `raw` after the codec and survives as an unmanaged key.
 */
const EDIT_STATE_KEYS = new Set(["overrides","saveProficiencies","skillProficiencies","activeSenses","customSenses","activeSections","xp","proficiencyBonus","extras"]);

export interface EditableMonster extends Monster {
  overrides: Set<string>;
  saveProficiencies: Record<string, boolean>;
  skillProficiencies: Record<string, SkillProficiency>;
  activeSenses: Record<string, string | null>;
  customSenses: string[];
  activeSections: string[];
  xp: number;
  proficiencyBonus: number;
  /**
   * The unmanaged keys, recorded for the editors' bookkeeping; the runtime carrier is the `...monster` spread.
   * R4-G7 §7.4 (a) · with ONE exception, which is a real carrier and not bookkeeping: a non-array value under a
   * `SECTION_KEY_MAP` key is deleted from the editable and recorded here (the five MANAGED section keys included,
   * which the `!MANAGED.has(k)` loop would otherwise skip), and `editableToMonster` re-emits it from here.
   */
  extras: Record<string, unknown>;
}

/**
 * Convert a Monster to an EditableMonster by inferring proficiencies,
 * parsing senses, and detecting active sections. Every key outside MANAGED travels through the `...monster`
 * spread and is also recorded in `extras`.
 *
 * R4-G6b §4.4 · `abilities`, `hp`, `ac`, `speed`, `saves`, `skills`, `senses` and `languages` are deep-copied
 * field by field below, and EVERY feature array `SECTION_KEY_MAP` names is deep-copied after them (element by
 * element, a shallow copy of each PLAIN-object entry). Without that loop those seven arrays ride the `...monster`
 * spread BY REFERENCE, so `addFeature` / `removeFeature` write into an array `original` still points at and
 * `cancel()`, which rebuilds from `original`, cannot revert a feature edit.
 */
export function monsterToEditable(monster: Monster): EditableMonster {
  // The LOOKUP key only: the editable's `cr` FIELD keeps the authored value through the `...monster` spread, so
  // an object `cr` (its `xp_lair` / `lair` / `coven` / `xp` leaves) round-trips unchanged on save.
  const cr = crString(monster.cr) ?? "0";
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
  // The section key vocabulary is SECTION_KEY_MAP's snake_case (`bonus_actions`), in ALL_SECTIONS order.
  if (monster.bonus_actions && monster.bonus_actions.length > 0) activeSections.push("bonus_actions");
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

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(monster)) if (!MANAGED.has(k)) extras[k] = v;

  const editable: EditableMonster = {
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
    // `formatCR`, not a table read on `cr`: the lookup key is normalised there (a decimal `0.25` finds `1/4`) and an
    // authored `xp` override wins, so edit mode shows the SAME XP as the rendered Challenge line. `cr` above stays
    // the authored string, which is what the PB lookup and the CR select want.
    xp: formatCR(monster.cr)?.xp ?? 0,
    proficiencyBonus: profBonus,
    extras,
  };

  // R4-G6b §4.4: every feature array the add-section dropdown can open, deep-copied so `addFeature` / `removeFeature`
  // never write into an array `original` still points at. Read through the same `Record<string, unknown>` cast
  // `addFeature` uses: `SectionKey` carries `mythic_actions`, which is not a `Monster` key, and `lair_actions` is
  // `unknown[]`, so neither a typed index nor a typed element is available here.
  //
  // Only PLAIN OBJECT entries are copied (R4-G6b §4.4, T5 review). `lair_actions` is `unknown[]`, and in the shipped
  // corpus all 222 converter notes carrying the key start with a scalar string or a `{ type: list, items: [...] }`
  // node, never a `{ name, entries }` feature: spreading a string yields a per-character object, which
  // `editableToMonster`'s unmanaged pass would then write to the note. Scalars, `null` and nested arrays pass
  // through by reference (nothing writes into them), and `Array.isArray` replaces a truthiness test so an authored
  // scalar `lair_actions: some text` cannot throw at open.
  //
  // R4-G7 §7.4 · PLAIN means the prototype IS `Object.prototype`, not merely `typeof f === "object"`. js-yaml loads
  // an unquoted ISO scalar as a `Date`, whose own enumerable keys are none, so the old test spread it to `{}` and
  // destroyed the authored value on the next save. A `Date`, a class instance and an array now all ride by
  // reference, exactly like a scalar; only an entry the editors actually write into is copied.
  const src = monster as unknown as Record<string, unknown>;
  const out = editable as unknown as Record<string, unknown>;
  for (const k of Object.values(SECTION_KEY_MAP)) {
    const raw = src[k];
    if (!Array.isArray(raw)) {
      // R4-G7 §7.4 (a) · a non-array value under a section key is not feature data, and leaving it on the editable
      // is what let `getFeatures` hand a string back cast as `Feature[]` and `MonsterEditState.addFeature` call
      // `.push` on it (a TypeError). It is DELETED here, and `editableToMonster` re-emits it from `extras` so the
      // save stays lossless under R4-G6 §9 invariant 7. `extras` already holds the value for the two UNMANAGED
      // section keys (`lair_actions`, `mythic_actions`) from the loop above, which skips MANAGED keys, so the five
      // managed ones are carried in here; `null` is carried like any other value, so an authored `lair_actions:`
      // with no items keeps the behaviour it has always had. MEASURED over the 13,835-file converter corpus: zero
      // documents carry either shape (`evidence/g7-t3-section-scalar-population.txt`), so this is a hardening for
      // hand-authored and homebrew notes, not a repair of shipped data.
      if (raw !== undefined) extras[k] = raw;
      delete out[k];
      continue;
    }
    const arr = raw as unknown[];
    out[k] = arr.map((f) => (f !== null && typeof f === "object" && Object.getPrototypeOf(f) === Object.prototype ? { ...f } : f));
  }

  return editable;
}

/**
 * Convert an EditableMonster back to a plain Monster: the UNMANAGED keys are copied first (the `...monster` spread
 * in `monsterToEditable` carries them at runtime) and the managed keys are written OVER them, recalculating saves,
 * skills, senses and passive perception from the editable state. The edit state's own fields (EDIT_STATE_KEYS) are
 * never emitted, so the save is lossless for everything the editors do not own (R4-G6 §9, invariant 7).
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

  // The unmanaged keys FIRST; the managed copies below overwrite them.
  for (const [k, v] of Object.entries(editable)) if (!MANAGED.has(k) && !EDIT_STATE_KEYS.has(k) && v !== undefined) (monster as unknown as Record<string, unknown>)[k] = v;

  // R4-G7 §7.4 (a) under R4-G6 §9 invariant 7 · `monsterToEditable` DELETES a non-array value from the editable
  // under a section key, so nothing on the editable can carry it to the save. Its authored VALUE still has to
  // reach the note unchanged, so it is re-emitted from `extras`, which is where the copy site recorded it. The
  // guard is ABSENCE on the editable, never falsiness, so a falsy value the editors themselves wrote is the user's
  // and wins. A deliberate clear is never resurrected either, but that takes `removeSection` doing TWO things
  // (R4-G7 T3 fix round 1): it writes `[]` when the key is defined, which is the array-authored section, and it
  // deletes the carrier from `extras` when it is not, which is the scalar-authored one the copy site emptied.
  // The managed writes below cannot clobber these keys either, since every one of their guards reads the same
  // absent field.
  const sectionExtras = editable.extras ?? {};
  for (const k of Object.values(SECTION_KEY_MAP)) {
    if ((editable as unknown as Record<string, unknown>)[k] === undefined && sectionExtras[k] !== undefined) {
      (monster as unknown as Record<string, unknown>)[k] = sectionExtras[k];
    }
  }

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
  if (sections.includes("bonus_actions") && editable.bonus_actions && editable.bonus_actions.length > 0) monster.bonus_actions = editable.bonus_actions;
  if (sections.includes("legendary_actions") && editable.legendary_actions && editable.legendary_actions.length > 0) monster.legendary_actions = editable.legendary_actions;
  if (editable.legendary_action_uses !== undefined) monster.legendary_action_uses = editable.legendary_action_uses;
  if (editable.legendary_resistance !== undefined) monster.legendary_resistance = editable.legendary_resistance;
  if (editable.columns !== undefined) monster.columns = editable.columns;

  return monster;
}

// -----------------------------------------------------------------------------
// recalculate (formerly src/dnd/recalculate.ts)
// -----------------------------------------------------------------------------

/**
 * R4-G7 §7.4 · the ONLY `changedField` names whose edit re-derives `hp.average` from the hit dice. The MEASURED
 * writers of those names, and the whole reason the set has four members:
 * - `edit/combat-editor.ts:70-71` fires `updateField("hp.formula", …)` immediately followed by
 *   `updateField("hp", hp)` carrying the PRE-edit average, so both names have to recompute or the second call
 *   would put the stale average straight back;
 * - `edit/combat-editor.ts:54-59` wires the override: `setOverride("hp", val)` + `updateField("hp", hp)` (the
 *   `!overrides.has("hp")` guard below is what keeps that value), and the "(Auto)" restore routes through
 *   `clearOverride("hp")` -> `recalculate(_, "hp")`, which is the ONE call that has to re-derive it;
 * - the `size` branch above rewrites the formula's die size first, so `"size"` must recompute after it;
 * - `edit/abilities-editor.ts:41` sends the whole `abilities` object under the single name `"abilities"` (no
 *   `abilities.<key>` name reaches here from the app), so CON edits arrive as `"abilities"`.
 * Every OTHER field (an AC, CR, speed, name, senses, saves or skills edit) leaves the authored average alone, so a
 * formula's flat bonus survives the edit and an edit-then-revert compares unchanged under Q-2's save guard.
 */
const HP_FIELDS = new Set(["hp.formula", "hp", "size", "abilities"]);

export function recalculate(monster: EditableMonster, changedField: string): EditableMonster {
  const result = { ...monster };
  const abilities = result.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // CR change -> update proficiency bonus and XP
  if (changedField === "cr") {
    result.proficiencyBonus = proficiencyBonusFromCR(crString(result.cr) ?? "0");
    if (!result.overrides.has("xp")) {
      result.xp = formatCR(result.cr)?.xp ?? 0;      // the same normalised lookup as `monsterToEditable`
    }
  }
  const profBonus = result.proficiencyBonus;

  // Size change -> update hit dice size in formula
  if (changedField === "size" && result.hp?.formula) {
    const parsed = parseHitDiceFormula(result.hp.formula);
    if (parsed) {
      const newSize = hitDiceSizeFromCreatureSize(sizeWord(result.size));
      result.hp = { ...result.hp, formula: `${parsed.count}d${newSize}` };
    }
  }

  // Recalculate HP from hit dice + CON mod, for an HP_FIELDS edit only (R4-G7 §7.4)
  if (HP_FIELDS.has(changedField) && !result.overrides.has("hp") && result.hp?.formula) {
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
    setNestedField(this._current as unknown as Record<string, unknown>, field, value);
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
    setNestedField(this._current as unknown as Record<string, unknown>, field, value);
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
      if (key && !(this._current as unknown as Record<string, unknown>)[key]) {
        (this._current as unknown as Record<string, unknown>)[key] = [];
      }
      this._hasPendingChanges = true;
      this.onChange(this);
    }
  }

  removeSection(section: string): void {
    this._current.activeSections = this._current.activeSections.filter(s => s !== section);
    // Clear the feature data so the section is not serialized on save
    if ((this._current as unknown as Record<string, unknown>)[section] !== undefined) {
      (this._current as unknown as Record<string, unknown>)[section] = [];
    }
    // R4-G7 T3 fix round 1 · and clear the CARRIER, which is the other half of "the section is not serialized on
    // save" since §7.4 (a). A scalar-authored section has no key on the editable (the copy site deleted it), so the
    // branch above is a no-op for it and `editableToMonster`'s re-emit would put the authored value straight back.
    // Deleting the carrier is chosen over writing `[]` unconditionally because it leaves the ARRAY path byte
    // identical (the key is defined there, so the branch above already wrote `[]`, and the re-emit was already
    // skipped by presence) while leaving NO stale carrier behind for a later absence to resurrect.
    delete this._current.extras[section];
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  addFeature(sectionKey: string): void {
    const features = (this._current as unknown as Record<string, unknown>)[sectionKey] as Array<{name: string; entries: string[]}> | undefined;
    if (features) {
      features.push({ name: "New Feature", entries: [""] });
    } else {
      (this._current as unknown as Record<string, unknown>)[sectionKey] = [{ name: "New Feature", entries: [""] }];
    }
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  removeFeature(sectionKey: string, index: number): void {
    const features = (this._current as unknown as Record<string, unknown>)[sectionKey] as Array<unknown> | undefined;
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
