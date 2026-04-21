import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ActionCategory,
  type ConverterAbilities,
} from "./srd-tag-converter";
import { proficiencyBonusFromCR } from "../dnd/math";
import { toStringSafe } from "../parsers/yaml-utils";

// ---------------------------------------------------------------------------
// SRD Data Normalizer
// ---------------------------------------------------------------------------
// Transforms raw open5e.com SRD data into the format expected by our parsers.
// The SRD JSON uses different field names and shapes than our YAML schema.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Monster normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize an SRD monster record into the shape our monster parser expects.
 *
 * SRD fields like `armor_class`, `hit_points`, `strength`, `special_abilities`
 * are mapped to `ac`, `hp`, `abilities`, `traits`, etc.
 */
export function normalizeSrdMonster(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // -- Pass-through fields --------------------------------------------------
  if (raw.name != null) out.name = raw.name;
  if (raw.size != null) out.size = raw.size;
  if (raw.type != null) out.type = raw.type;
  if (raw.subtype != null && raw.subtype !== "") out.subtype = raw.subtype;
  if (raw.alignment != null && raw.alignment !== "") out.alignment = raw.alignment;

  // -- AC -------------------------------------------------------------------
  const armorClass = raw.armor_class;
  if (armorClass != null) {
    const acEntry: Record<string, unknown> = { ac: Number(armorClass) };
    const armorDesc = raw.armor_desc;
    if (armorDesc != null && toStringSafe(armorDesc).trim() !== "") {
      acEntry.from = [toStringSafe(armorDesc)];
    }
    out.ac = [acEntry];
  }

  // -- HP -------------------------------------------------------------------
  const hitPoints = raw.hit_points;
  if (hitPoints != null) {
    const hpObj: Record<string, unknown> = { average: Number(hitPoints) };
    if (raw.hit_dice != null) {
      hpObj.formula = toStringSafe(raw.hit_dice);
    }
    out.hp = hpObj;
  }

  // -- Speed ----------------------------------------------------------------
  if (raw.speed != null && typeof raw.speed === "object") {
    const srdSpeed = raw.speed as Record<string, unknown>;
    const speed: Record<string, number> = {};
    for (const key of ["walk", "fly", "swim", "climb", "burrow"]) {
      if (srdSpeed[key] != null) speed[key] = Number(srdSpeed[key]);
    }
    if (Object.keys(speed).length > 0) out.speed = speed;
  }

  // -- Abilities ------------------------------------------------------------
  const abilityMap: [string, string][] = [
    ["strength", "str"],
    ["dexterity", "dex"],
    ["constitution", "con"],
    ["intelligence", "int"],
    ["wisdom", "wis"],
    ["charisma", "cha"],
  ];
  const hasAbilities = abilityMap.some(([srd]) => raw[srd] != null);
  if (hasAbilities) {
    const abilities: Record<string, number> = {};
    for (const [srd, short] of abilityMap) {
      abilities[short] = raw[srd] != null ? Number(raw[srd]) : 10;
    }
    out.abilities = abilities;
  }

  // -- Saves ----------------------------------------------------------------
  const saveMap: [string, string][] = [
    ["strength_save", "str"],
    ["dexterity_save", "dex"],
    ["constitution_save", "con"],
    ["intelligence_save", "int"],
    ["wisdom_save", "wis"],
    ["charisma_save", "cha"],
  ];
  const saves: Record<string, number> = {};
  for (const [srd, short] of saveMap) {
    if (raw[srd] != null) saves[short] = Number(raw[srd]);
  }
  if (Object.keys(saves).length > 0) out.saves = saves;

  // -- Skills ---------------------------------------------------------------
  if (raw.skills != null && typeof raw.skills === "object") {
    const srdSkills = raw.skills as Record<string, unknown>;
    const skills: Record<string, number> = {};
    for (const [key, val] of Object.entries(srdSkills)) {
      if (val != null) skills[key] = Number(val);
    }
    if (Object.keys(skills).length > 0) out.skills = skills;
  }

  // -- Senses & Passive Perception ------------------------------------------
  if (raw.senses != null && typeof raw.senses === "string" && raw.senses !== "") {
    const sensesStr = raw.senses;
    const parts = sensesStr.split(",").map((s: string) => s.trim()).filter(Boolean);
    const senses: string[] = [];
    let passivePerception: number | undefined;

    for (const part of parts) {
      const ppMatch = part.match(/passive\s+perception\s+(\d+)/i);
      if (ppMatch) {
        passivePerception = Number(ppMatch[1]);
      } else {
        senses.push(part);
      }
    }

    if (senses.length > 0) out.senses = senses;
    if (passivePerception != null) out.passive_perception = passivePerception;
  }

  // -- Languages ------------------------------------------------------------
  if (raw.languages != null && typeof raw.languages === "string" && raw.languages !== "") {
    const langs = raw.languages
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (langs.length > 0) out.languages = langs;
  }

  // -- Damage/Condition fields (string -> array) ----------------------------
  const listFields = [
    "damage_vulnerabilities",
    "damage_resistances",
    "damage_immunities",
    "condition_immunities",
  ];
  for (const field of listFields) {
    const val = raw[field];
    if (val != null && typeof val === "string" && val !== "") {
      out[field] = val.split(",").map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(val)) {
      // Already an array — pass through
      out[field] = val;
    }
  }

  // -- CR -------------------------------------------------------------------
  if (raw.challenge_rating != null) {
    out.cr = toStringSafe(raw.challenge_rating);
  } else if (raw.cr != null) {
    out.cr = toStringSafe(raw.cr);
  }

  // -- Feature blocks -------------------------------------------------------
  const normalizeFeaturesRaw = (
    arr: unknown,
  ): { name: string; entries: string[] }[] | undefined => {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr.map((f: Record<string, unknown>) => ({
      name: toStringSafe(f.name),
      entries: f.desc != null ? [toStringSafe(f.desc)] : [],
    }));
  };

  const abilitiesOut = out.abilities as ConverterAbilities | undefined;
  const profBonus = proficiencyBonusFromCR(toStringSafe(out.cr ?? "0"));

  // Build provisional traits to detect spellcasting ability
  const rawTraits = normalizeFeaturesRaw(raw.special_abilities);
  const spellAbility = detectSpellcastingAbility(rawTraits);

  const normalizeFeaturesWithTags = (
    arr: unknown,
    category: ActionCategory,
  ): { name: string; entries: string[] }[] | undefined => {
    const rawFeatures = normalizeFeaturesRaw(arr);
    if (!rawFeatures) return undefined;
    if (!abilitiesOut) return rawFeatures;
    return rawFeatures.map((f) => ({
      name: f.name,
      entries: f.entries.map((desc) =>
        convertDescToTags(desc, {
          abilities: abilitiesOut,
          profBonus,
          actionName: f.name,
          actionCategory: category,
          spellAbility,
        }),
      ),
    }));
  };

  // special_abilities -> traits
  const traits = normalizeFeaturesWithTags(raw.special_abilities, "trait");
  if (traits) out.traits = traits;

  // actions
  const actions = normalizeFeaturesWithTags(raw.actions, "action");
  if (actions) out.actions = actions;

  // reactions
  const reactions = normalizeFeaturesWithTags(raw.reactions, "reaction");
  if (reactions) out.reactions = reactions;

  // legendary_actions -> legendary
  const legendary = normalizeFeaturesWithTags(raw.legendary_actions, "legendary");
  if (legendary) out.legendary = legendary;

  // bonus_actions
  const bonusActions = normalizeFeaturesWithTags(raw.bonus_actions, "bonus");
  if (bonusActions) out.bonus_actions = bonusActions;

  // -- Legendary description -> legendary_actions count ---------------------
  if (raw.legendary_desc != null && typeof raw.legendary_desc === "string") {
    const ldMatch = raw.legendary_desc.match(/can take (\d+) legendary action/i);
    if (ldMatch) {
      out.legendary_actions = Number(ldMatch[1]);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Magic Item normalizer
// ---------------------------------------------------------------------------

const ATTUNEMENT_PREFIX = "requires attunement";

/**
 * Fields specific to open5e item metadata that should be dropped.
 */
const ITEM_DROP_FIELDS = new Set([
  "slug",
  "document__slug",
  "document__title",
  "document__license_url",
  "document__url",
]);

/**
 * Normalize an SRD item record into the shape our item parser expects.
 *
 * Key transformations:
 * - `desc` (string)        -> `entries` (string[]) split on double newlines
 * - `requires_attunement`  -> `attunement` (boolean | string)
 * - Drops open5e metadata fields (slug, document__*)
 */
export function normalizeSrdItem(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (!ITEM_DROP_FIELDS.has(k) && !k.startsWith("document__")) {
      out[k] = v;
    }
  }

  // --- desc -> entries -------------------------------------------------------
  if (typeof out.desc === "string") {
    const text = out.desc;
    out.entries = text
      .split("\n\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    delete out.desc;
  }

  // --- requires_attunement -> attunement -------------------------------------
  if ("requires_attunement" in out) {
    const ra = out.requires_attunement;
    if (typeof ra === "string") {
      const lower = ra.toLowerCase().trim();
      if (lower === "" || lower === "no") {
        out.attunement = false;
      } else if (lower === ATTUNEMENT_PREFIX) {
        out.attunement = true;
      } else if (lower.startsWith(ATTUNEMENT_PREFIX)) {
        // "requires attunement by a cleric" -> "by a cleric"
        out.attunement = ra.slice(ATTUNEMENT_PREFIX.length).trim();
      } else {
        // Unknown format — pass through as-is
        out.attunement = ra;
      }
    } else if (typeof ra === "boolean") {
      out.attunement = ra;
    } else {
      out.attunement = false;
    }
    delete out.requires_attunement;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Spell normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize an SRD spell record into the shape our spell parser expects.
 *
 * Field mapping:
 *   spell_level | level_int  ->  level            (number)
 *   desc                     ->  description      (string[])
 *   higher_level             ->  at_higher_levels  (string[], empty filtered)
 *   concentration "yes"/bool ->  concentration     (boolean)
 *   ritual "yes"/bool        ->  ritual            (boolean)
 *   dnd_class | spell_lists  ->  classes           (string[])
 *
 * Pass-through: name, school, casting_time, range, components, duration
 * Dropped: slug, page, document__*, material, archetype, circles, etc.
 */
export function normalizeSrdSpell(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // --- name (required) ---
  out.name = raw.name;

  // --- level ---
  const rawLevel = raw.spell_level ?? raw.level_int ?? raw.level;
  if (rawLevel != null) {
    out.level = Number(rawLevel);
  }

  // --- school ---
  if (raw.school != null) out.school = toStringSafe(raw.school);

  // --- casting_time ---
  if (raw.casting_time != null) out.casting_time = toStringSafe(raw.casting_time);

  // --- range ---
  if (raw.range != null) out.range = toStringSafe(raw.range);

  // --- components ---
  if (raw.components != null) out.components = toStringSafe(raw.components);

  // --- duration ---
  if (raw.duration != null) out.duration = toStringSafe(raw.duration);

  // --- concentration ---
  if (raw.requires_concentration != null) {
    out.concentration = Boolean(raw.requires_concentration);
  } else if (raw.concentration != null) {
    out.concentration =
      typeof raw.concentration === "string"
        ? raw.concentration.toLowerCase() === "yes"
        : Boolean(raw.concentration);
  }

  // --- ritual ---
  if (raw.can_be_cast_as_ritual != null) {
    out.ritual = Boolean(raw.can_be_cast_as_ritual);
  } else if (raw.ritual != null) {
    out.ritual =
      typeof raw.ritual === "string"
        ? raw.ritual.toLowerCase() === "yes"
        : Boolean(raw.ritual);
  }

  // --- classes ---
  if (Array.isArray(raw.spell_lists) && raw.spell_lists.length > 0) {
    out.classes = (raw.spell_lists as string[]).map(capitalizeWord);
  } else if (typeof raw.dnd_class === "string" && raw.dnd_class.length > 0) {
    out.classes = raw.dnd_class
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
      .map(capitalizeWord);
  } else if (Array.isArray(raw.classes)) {
    // Already in the expected format
    out.classes = raw.classes;
  }

  // --- description ---
  if (typeof raw.desc === "string" && raw.desc.length > 0) {
    out.description = raw.desc
      .split("\n\n")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  } else if (Array.isArray(raw.description)) {
    // Already in expected format
    out.description = raw.description;
  }

  // --- at_higher_levels ---
  if (typeof raw.higher_level === "string" && raw.higher_level.length > 0) {
    out.at_higher_levels = raw.higher_level
      .split("\n\n")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  } else if (Array.isArray(raw.at_higher_levels)) {
    // Already in expected format
    out.at_higher_levels = raw.at_higher_levels;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capitalize the first letter of a string (used for class names). */
function capitalizeWord(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
