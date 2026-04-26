import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ActionCategory,
  type ConverterAbilities,
} from "../dnd/srd-tag-converter";
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
// Armor normalizer
// ---------------------------------------------------------------------------

const ARMOR_CATEGORY_MAP: Record<string, string> = {
  "light armor": "light",
  "medium armor": "medium",
  "heavy armor": "heavy",
  shield: "shield",
  spell: "spell",
  "class feature": "feature",
  natural: "natural",
};

const ARMOR_DROP_FIELDS = new Set([
  "document__slug",
  "document__title",
  "document__license_url",
  "document__url",
  // Open5e raw fields we lift into the canonical `ac` object below.
  "base_ac",
  "plus_dex_mod",
  "plus_con_mod",
  "plus_wis_mod",
  "plus_flat_mod",
  "plus_max",
  "ac_string",
]);

/**
 * Normalize an Open5e armor record into the shape the armor parser expects.
 *
 * Open5e splits AC into `base_ac`, `plus_dex_mod`, `plus_con_mod`, `plus_wis_mod`,
 * `plus_flat_mod`, `plus_max`, `ac_string`. The plugin schema expects a single
 * structured `ac: { base, flat, add_dex, dex_max?, add_con, add_wis, description? }`.
 * Categories arrive as title case ("Heavy Armor", "Class Feature") and are
 * lowercased to the canonical enum.
 */
export function normalizeSrdArmor(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Pass-through scalars (excluding fields we lift into ac{}).
  for (const [k, v] of Object.entries(raw)) {
    if (ARMOR_DROP_FIELDS.has(k) || k.startsWith("document__")) continue;
    out[k] = v;
  }

  // -- Category --------------------------------------------------------------
  if (typeof raw.category === "string") {
    const key = raw.category.toLowerCase().trim();
    out.category = ARMOR_CATEGORY_MAP[key] ?? key;
  }

  // -- AC --------------------------------------------------------------------
  const acObj: Record<string, unknown> = {
    base: Number(raw.base_ac ?? 0),
    flat: Number(raw.plus_flat_mod ?? 0),
    add_dex: Boolean(raw.plus_dex_mod),
    add_con: Boolean(raw.plus_con_mod),
    add_wis: Boolean(raw.plus_wis_mod),
  };
  const plusMax = Number(raw.plus_max ?? 0);
  if (acObj.add_dex && plusMax > 0) acObj.dex_max = plusMax;
  if (out.category === "shield" && Number(acObj.flat) > 0) {
    // Open5e's ac_string for shields is "0 +N" which renders as a bare "0 +2".
    // The conventional shield display is just the flat bonus.
    acObj.description = `+${acObj.flat}`;
  } else if (typeof raw.ac_string === "string" && raw.ac_string.length > 0) {
    acObj.description = raw.ac_string;
  }
  out.ac = acObj;

  // -- Cleanup empty/null fields the schema would reject or clutter ----------
  if (raw.strength_requirement == null) delete out.strength_requirement;
  if (raw.stealth_disadvantage === false) delete out.stealth_disadvantage;
  if (raw.weight === "") delete out.weight;
  if (raw.cost === "0 gp") delete out.cost;

  return out;
}

// ---------------------------------------------------------------------------
// Weapon normalizer
// ---------------------------------------------------------------------------

const WEAPON_CATEGORY_MAP: Record<string, string> = {
  "simple melee weapons": "simple-melee",
  "simple ranged weapons": "simple-ranged",
  "martial melee weapons": "martial-melee",
  "martial ranged weapons": "martial-ranged",
  natural: "natural",
};

const WEAPON_DROP_FIELDS = new Set([
  "document__slug",
  "document__title",
  "document__license_url",
  "document__url",
  "damage_dice",
  "damage_type",
]);

// Property strings whose hyphen form needs converting to the underscore form
// the Phase 0.5 weapon parser's FLAG_PROPERTIES set recognizes.
const HYPHEN_PROPERTY_MAP: Record<string, string> = {
  "two-handed": "two_handed",
};

function normalizeWeaponProperty(p: unknown): unknown {
  if (typeof p !== "string") return p;
  const lower = p.toLowerCase().trim();
  return HYPHEN_PROPERTY_MAP[lower] ?? p;
}

function parseWeightLb(v: unknown): number | string | undefined {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const m = trimmed.match(/^([\d.]+)\s*lb\.?$/i);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : trimmed;
  }
  return trimmed;
}

/**
 * Normalize an Open5e weapon record into the shape the weapon parser expects.
 *
 * Open5e splits damage into `damage_dice` and `damage_type`; the plugin
 * schema expects a single structured `damage: { dice, type, versatile_dice? }`.
 * Categories arrive as title case ("Martial Ranged Weapons") and are mapped
 * to the canonical kebab-case enum. Hyphen-form property names like
 * "two-handed" are converted to "two_handed" so the parser's flag set
 * recognizes them.
 */
export function normalizeSrdWeapon(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (WEAPON_DROP_FIELDS.has(k) || k.startsWith("document__")) continue;
    out[k] = v;
  }

  // -- Category --------------------------------------------------------------
  if (typeof raw.category === "string") {
    const key = raw.category.toLowerCase().trim();
    out.category = WEAPON_CATEGORY_MAP[key] ?? key;
  }

  // -- Damage ----------------------------------------------------------------
  const dice = raw.damage_dice;
  const dtype = raw.damage_type;
  if (dice != null || dtype != null) {
    out.damage = {
      dice: typeof dice === "string" ? dice : "",
      type: typeof dtype === "string" ? dtype : "",
    };
  }

  // -- Properties (normalize hyphen-form names) ------------------------------
  if (Array.isArray(raw.properties)) {
    out.properties = raw.properties.map(normalizeWeaponProperty);
  }

  // -- Weight (strip "lb." suffix to a number where possible) ---------------
  const w = parseWeightLb(raw.weight);
  if (w === undefined) delete out.weight;
  else out.weight = w;

  if (raw.cost === "0 gp" || raw.cost === "") delete out.cost;

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
 * Structured-mechanical fields that may have been merged onto the bundled
 * record by the augmentation script. They are passed through verbatim so
 * downstream parsers / the entity registry can read them off `ItemEntity`.
 */
const ITEM_STRUCTURED_PASSTHROUGH = [
  "bonuses",
  "resist",
  "immune",
  "vulnerable",
  "condition_immune",
  "attached_spells",
  "grants",
  "charges",
  "tier",
  "base_item",
] as const;

/**
 * Normalize an SRD item record into the shape our item parser expects.
 *
 * Key transformations:
 * - `desc` (string)        -> `entries` (string[]) split on double newlines
 * - `requires_attunement`  -> `attunement` (boolean | string)
 * - Drops metadata fields (slug, document__*)
 *
 * Structured mechanical fields (bonuses, resist, immune, vulnerable,
 * condition_immune, attached_spells, grants, charges, tier, base_item) are
 * passed through unchanged when present. A canonical `attunement` object
 * (with `required`, `restriction`, `tags`) on the input takes precedence
 * over the legacy `requires_attunement` string.
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

  // --- attunement (canonical object form takes precedence) -------------------
  // The augmenter may have written a structured `attunement: { required, … }`.
  // Honor that and skip the legacy string-derivation step entirely so we don't
  // overwrite the richer shape with a plain bool/string.
  const hasCanonicalAttunement =
    out.attunement !== undefined &&
    typeof out.attunement === "object" &&
    out.attunement !== null &&
    !Array.isArray(out.attunement);

  if (!hasCanonicalAttunement && "requires_attunement" in out) {
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
  }
  // Always strip the legacy field after canonical resolution.
  if ("requires_attunement" in out) {
    delete out.requires_attunement;
  }

  // --- Structured fields pass through unchanged ------------------------------
  // (no-op when absent; the for-loop above already copied them onto `out`,
  // this list documents the supported fields and is referenced by tests.)
  void ITEM_STRUCTURED_PASSTHROUGH;

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
