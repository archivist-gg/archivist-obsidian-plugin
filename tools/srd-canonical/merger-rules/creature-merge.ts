import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import type { Attack } from "../../../src/shared/types/attack";
import type { Feature, FeatureRecharge } from "../../../src/shared/types/feature";
import {
  convertDescToTags,
  type ConversionContext,
  type ConverterAbilities,
} from "../../../src/shared/dnd/srd-tag-converter";

interface Open5eDamageType {
  key: string;
  name: string;
}

interface Open5eAttack {
  name: string;
  attack_type?: string;
  to_hit_mod: number;
  reach: number | null;
  range: number | null;
  long_range: number | null;
  target_creature_only?: boolean;
  damage_die_count: number | null;
  damage_die_type: string | null;
  damage_bonus: number | null;
  damage_type: Open5eDamageType | null;
  extra_damage_die_count: number | null;
  extra_damage_die_type: string | null;
  extra_damage_bonus: number | null;
  extra_damage_type: Open5eDamageType | null;
  distance_unit?: string;
}

interface Open5eAction {
  name: string;
  desc: string;
  action_type: string;
  legendary_action_cost?: number | null;
  usage_limits?: { type: string; param: number } | null;
  attacks?: Open5eAttack[];
  order_in_statblock?: number;
}

interface Open5eTrait {
  name: string;
  desc: string;
}

interface Open5eResistancesAndImmunities {
  damage_immunities?: Array<{ key: string; name?: string }>;
  damage_resistances?: Array<{ key: string; name?: string }>;
  damage_vulnerabilities?: Array<{ key: string; name?: string }>;
  condition_immunities?: Array<{ key: string; name?: string }>;
}

export interface CreatureCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  size: string;
  type: string;
  subtype?: string;
  alignment?: string;
  description?: string;
  ac: Array<{ ac: number; from?: string[] }>;
  hp: { average: number; formula?: string };
  speed: Record<string, number>;
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  cr?: string;
  saves?: Record<string, number>;
  skills?: Record<string, number>;
  senses: string[];
  passive_perception?: number;
  languages: string[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: string[];
  actions: Feature[];
  reactions: Feature[];
  legendary_actions: Feature[];
  legendary_resistance?: number;
  traits: Feature[];
}

export const creatureMergeRule: MergeRule = {
  kind: "creature",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Creatures are well-structured in Open5e; no overlay applies here.
    return null;
  },
};

const ABILITY_KEY_MAP: Record<string, "str" | "dex" | "con" | "int" | "wis" | "cha"> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function toShortAbilityKeys(rec: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec ?? {})) {
    if (typeof v !== "number") continue;
    const short = ABILITY_KEY_MAP[k.toLowerCase()] ?? k;
    out[short] = v;
  }
  return out;
}

function dieToString(count: number, dieType: string, bonus: number | null | undefined): string {
  // dieType is "D6", "D10" etc. Normalize to lowercase "d6".
  const die = dieType.toLowerCase().replace(/^d/, "d");
  const dice = `${count}${die.startsWith("d") ? die : `d${die}`}`;
  if (bonus != null && bonus !== 0) return bonus > 0 ? `${dice}+${bonus}` : `${dice}${bonus}`;
  return dice;
}

/**
 * Convert an Open5e v2 attack to the shared Attack shape.
 *
 * Edition-aware damage location:
 * - 2014: primary damage in damage_* fields. (damage_type may be polluted in
 *   the cache — we still surface it; renderer/parser pass it through.)
 * - 2024: primary damage often in extra_damage_*; damage_* fields are null.
 *
 * Strategy: pick whichever set has a non-null damage_type as primary. If both
 * are populated, treat damage_* as primary and extra_* as extra_damage.
 */
function open5eAttackToAttack(oa: Open5eAttack): Attack {
  const primaryHasDmg = oa.damage_type != null;
  const extraHasDmg = oa.extra_damage_type != null;

  // Pick whichever set has the dice numbers populated. In real Open5e 2024
  // data, the dice count/type/bonus may live in `damage_*` while the actual
  // damage_type label lives in `extra_damage_*` (alongside null dice). Choose
  // independently for dice vs type so we surface both correctly.
  const damageHasDice = oa.damage_die_count != null && oa.damage_die_type != null;
  const extraHasDice = oa.extra_damage_die_count != null && oa.extra_damage_die_type != null;

  // Dice: prefer damage_* if populated, else extra_*.
  let dmgCount: number | null;
  let dmgDie: string | null;
  let dmgBonus: number | null;
  if (damageHasDice) {
    dmgCount = oa.damage_die_count;
    dmgDie = oa.damage_die_type;
    dmgBonus = oa.damage_bonus;
  } else if (extraHasDice) {
    dmgCount = oa.extra_damage_die_count;
    dmgDie = oa.extra_damage_die_type;
    dmgBonus = oa.extra_damage_bonus;
  } else {
    dmgCount = null;
    dmgDie = null;
    dmgBonus = null;
  }

  // Type: prefer damage_type if non-null, else extra_damage_type.
  const dmgTypeKey: string | undefined = primaryHasDmg
    ? oa.damage_type?.key
    : extraHasDmg
      ? oa.extra_damage_type?.key
      : undefined;

  // Determine melee vs ranged: ranged when range > 0, else melee (reach implied).
  const isRanged = typeof oa.range === "number" && oa.range > 0;

  const a: Attack = {
    name: oa.name,
    type: isRanged ? "ranged" : "melee",
    bonus: oa.to_hit_mod,
  };

  if (dmgCount != null && dmgDie) {
    a.damage = dieToString(dmgCount, dmgDie, dmgBonus);
  }
  if (dmgTypeKey) {
    a.damage_type = dmgTypeKey;
  }

  const range: Attack["range"] = {};
  if (typeof oa.reach === "number" && oa.reach > 0) range.reach = oa.reach;
  if (typeof oa.range === "number" && oa.range > 0) range.normal = oa.range;
  if (typeof oa.long_range === "number" && oa.long_range > 0) range.long = oa.long_range;
  if (Object.keys(range).length > 0) a.range = range;

  // Extra (secondary) damage: only when BOTH sets carry their own dice + type
  // independently. In the 2024 single-attack case (dice in damage_*, type in
  // extra_damage_*) only one logical attack is described — those fields are
  // already merged above and there is no secondary damage to surface.
  if (damageHasDice && extraHasDice && primaryHasDmg && extraHasDmg) {
    a.extra_damage = {
      dice: dieToString(oa.extra_damage_die_count!, oa.extra_damage_die_type!, oa.extra_damage_bonus),
      type: oa.extra_damage_type!.key,
    };
  }

  return a;
}

// Open5e usage_limits.type → canonical FeatureRecharge.type. Both `RECHARGE`
// and `RECHARGE_ON_ROLL` carry the same semantics in observed Open5e v2 data
// (param = recharge threshold on a d6); collapse them to one canonical kind.
const USAGE_TYPE_MAP: Record<string, FeatureRecharge["type"]> = {
  RECHARGE_ON_ROLL: "recharge_on_roll",
  RECHARGE: "recharge_on_roll",
  PER_DAY: "per_day",
  PER_LONG_REST: "per_long_rest",
  PER_SHORT_REST: "per_short_rest",
};

/**
 * D&D 5e proficiency-bonus formula by Challenge Rating.
 * Mirrors scripts/migrate-formula-tags.ts:profBonusFromCR.
 */
function profBonusFromCR(cr: string | number | undefined): number {
  if (cr == null) return 2;
  const num = typeof cr === "string"
    ? cr.includes("/") ? Number(cr.split("/")[0]) / Number(cr.split("/")[1]) : Number(cr)
    : cr;
  if (!Number.isFinite(num)) return 2;
  if (num <= 4) return 2;
  if (num <= 8) return 3;
  if (num <= 12) return 4;
  if (num <= 16) return 5;
  if (num <= 20) return 6;
  if (num <= 24) return 7;
  if (num <= 28) return 8;
  return 9;
}

const ACTION_TYPE_TO_CATEGORY: Record<string, ConversionContext["actionCategory"]> = {
  ACTION: "action",
  REACTION: "reaction",
  LEGENDARY_ACTION: "legendary",
  BONUS_ACTION: "bonus",
};

interface MergerConvCtx {
  abilities: ConverterAbilities;
  profBonus: number;
  spellAbility?: ConversionContext["spellAbility"];
}

function actionToFeature(
  action: Open5eAction,
  edition: "2014" | "2024",
  ctx: MergerConvCtx,
): Feature {
  const rewritten = rewriteCrossRefs(action.desc ?? "", edition);
  const actionCategory = ACTION_TYPE_TO_CATEGORY[action.action_type] ?? "action";
  const converted = convertDescToTags(rewritten, {
    abilities: ctx.abilities,
    profBonus: ctx.profBonus,
    actionName: action.name,
    actionCategory,
    spellAbility: ctx.spellAbility,
  });
  const f: Feature = {
    name: action.name,
    entries: [converted],
  };
  if (action.attacks && action.attacks.length > 0) {
    f.attacks = action.attacks.map(open5eAttackToAttack);
  }
  const ul = action.usage_limits;
  if (ul && typeof ul.type === "string" && typeof ul.param === "number") {
    const mappedType = USAGE_TYPE_MAP[ul.type];
    if (mappedType) {
      f.recharge = { type: mappedType, param: ul.param };
    } else {
      // Surface unknown usage_limits.type values during build so future Open5e
      // additions get noticed instead of silently dropped.
      console.warn(
        `[creature-merge] unknown usage_limits.type "${ul.type}" on action "${action.name}" — recharge dropped`,
      );
    }
  }
  return f;
}

const SPELLCASTING_ABILITY_RE = /using\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+as\s+(?:the\s+|its?\s+)?spellcasting\s+ability/i;
const SPELLCASTING_ABILITY_RE_2 = /spellcasting\s+ability\s+is\s+(intelligence|wisdom|charisma)/i;

function detectActionsSpellAbility(
  actions: Open5eAction[],
  traits: Open5eTrait[],
): ConversionContext["spellAbility"] {
  // Search trait + action prose for "using <Ability> as the spellcasting ability"
  // (2024 phrasing) or "spellcasting ability is <Ability>" (2014 phrasing).
  const sources: string[] = [];
  for (const t of traits) sources.push(t.desc ?? "");
  for (const a of actions) sources.push(a.desc ?? "");
  for (const s of sources) {
    let m = s.match(SPELLCASTING_ABILITY_RE);
    if (m) {
      const word = m[1].toLowerCase();
      if (word === "intelligence") return "int";
      if (word === "wisdom") return "wis";
      if (word === "charisma") return "cha";
      // STR/DEX/CON spellcasting is non-canonical; ignore.
    }
    m = s.match(SPELLCASTING_ABILITY_RE_2);
    if (m) {
      const word = m[1].toLowerCase();
      if (word === "intelligence") return "int";
      if (word === "wisdom") return "wis";
      if (word === "charisma") return "cha";
    }
  }
  return undefined;
}

const SENSE_FIELD_LABELS: Array<[string, string]> = [
  ["darkvision_range", "darkvision"],
  ["blindsight_range", "blindsight"],
  ["tremorsense_range", "tremorsense"],
  ["truesight_range", "truesight"],
];

function composeSenses(base: Record<string, unknown>): string[] {
  const senses: string[] = [];
  for (const [field, label] of SENSE_FIELD_LABELS) {
    const v = base[field];
    if (typeof v === "number" && v > 0) {
      senses.push(`${label} ${v} ft.`);
    }
  }
  // passive Perception is a derived skill stat, not a spatial sense.
  // It is emitted as a top-level `passive_perception` field; the renderer
  // appends it to the senses line at render time. Keeping it out of this
  // array avoids double-emission.
  return senses;
}

function normalizeNamedKey(field: unknown, lower = true): string {
  if (typeof field === "string") return field;
  if (field && typeof field === "object") {
    const obj = field as { key?: string; name?: string };
    if (typeof obj.key === "string" && obj.key.length > 0) return obj.key;
    if (typeof obj.name === "string") return lower ? obj.name.toLowerCase() : obj.name;
  }
  return "";
}

function flatKeys(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(e => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object" && typeof (e as { key?: unknown }).key === "string") {
        return (e as { key: string }).key;
      }
      return "";
    })
    .filter(s => s.length > 0);
}

export function toCreatureCanonical(entry: CanonicalEntry): CreatureCanonical {
  const base = entry.base as unknown as Record<string, unknown>;

  const size = normalizeNamedKey(base.size);
  const type = normalizeNamedKey(base.type);

  const armorClass = typeof base.armor_class === "number" ? base.armor_class : 0;
  const armorDetail = typeof base.armor_detail === "string" ? base.armor_detail : "";
  const ac: Array<{ ac: number; from?: string[] }> = armorClass > 0
    ? [{ ac: armorClass, ...(armorDetail.length > 0 ? { from: [armorDetail] } : {}) }]
    : [];

  const hitPoints = typeof base.hit_points === "number" ? base.hit_points : 0;
  const hitDice = typeof base.hit_dice === "string" ? base.hit_dice : "";
  const hp: CreatureCanonical["hp"] = {
    average: hitPoints,
    ...(hitDice.length > 0 ? { formula: hitDice } : {}),
  };

  const abilityScoresRaw = (base.ability_scores ?? {}) as Record<string, unknown>;
  const ab = toShortAbilityKeys(abilityScoresRaw);
  const abilities: CreatureCanonical["abilities"] = {
    str: ab.str ?? 10,
    dex: ab.dex ?? 10,
    con: ab.con ?? 10,
    int: ab.int ?? 10,
    wis: ab.wis ?? 10,
    cha: ab.cha ?? 10,
  };

  const crRaw = base.challenge_rating;
  const cr = typeof crRaw === "number" || typeof crRaw === "string" ? String(crRaw) : undefined;

  const savingThrowsRaw = (base.saving_throws ?? {}) as Record<string, unknown>;
  const saves = toShortAbilityKeys(savingThrowsRaw);

  const skillsRaw = (base.skill_bonuses ?? {}) as Record<string, unknown>;
  const skills: Record<string, number> = {};
  for (const [k, v] of Object.entries(skillsRaw)) {
    if (typeof v === "number") skills[k] = v;
  }

  // Speed: Open5e v2 uses { walk, swim, fly, climb, burrow, unit }. Only emit modes > 0.
  const speedRaw = (base.speed ?? {}) as Record<string, unknown>;
  const speed: Record<string, number> = {};
  for (const k of ["walk", "fly", "swim", "climb", "burrow"]) {
    const v = speedRaw[k];
    if (typeof v === "number" && v > 0) speed[k] = v;
  }

  const senses = composeSenses(base);

  // Languages: as_string is the human-readable list.
  const langField = base.languages as { as_string?: string } | string | undefined;
  const languagesString = typeof langField === "string"
    ? langField
    : langField && typeof langField === "object" && typeof langField.as_string === "string"
      ? langField.as_string
      : "";
  const languages = languagesString
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Damage / condition arrays from resistances_and_immunities.
  const ri = (base.resistances_and_immunities ?? {}) as Open5eResistancesAndImmunities;
  const damage_immunities = flatKeys(ri.damage_immunities);
  const damage_resistances = flatKeys(ri.damage_resistances);
  const damage_vulnerabilities = flatKeys(ri.damage_vulnerabilities);
  const condition_immunities = flatKeys(ri.condition_immunities);

  // Compute proficiency bonus once for the whole creature. base.proficiency_bonus
  // is null for all real Open5e v2 entries — derive from CR via the standard
  // 5e formula. Used by the prose-to-formula-tag converter below.
  const profBonus = profBonusFromCR(cr);
  const converterAbilities: ConverterAbilities = abilities;

  // Actions split by action_type. Open5e returns `actions` alphabetically;
  // each action carries an `order_in_statblock` ordinal giving the canonical
  // position WITHIN its action_type bucket. Sort the whole list once by that
  // ordinal — bucketizing in a stable pass below preserves the per-bucket
  // ordering. Missing values fall to the end.
  const allActions = (Array.isArray(base.actions) ? [...(base.actions as Open5eAction[])] : []);
  allActions.sort(
    (a, b) =>
      (a.order_in_statblock ?? Number.MAX_SAFE_INTEGER) -
      (b.order_in_statblock ?? Number.MAX_SAFE_INTEGER),
  );
  const actions: Feature[] = [];
  const reactions: Feature[] = [];
  const legendary: Feature[] = [];

  // Heuristically detect the creature's spellcasting ability from prose so the
  // converter can resolve "spell save DC N" / "+N to hit with spell attacks"
  // to the correct ability tag for casters that use INT/WIS/CHA.
  const baseTraits = (Array.isArray(base.traits) ? (base.traits as Open5eTrait[]) : []);
  const spellAbility = detectActionsSpellAbility(allActions, baseTraits);
  const convCtx: MergerConvCtx = { abilities: converterAbilities, profBonus, spellAbility };

  for (const a of allActions) {
    if (a.action_type === "REACTION") {
      reactions.push(actionToFeature(a, entry.edition, convCtx));
    } else if (a.action_type === "LEGENDARY_ACTION") {
      legendary.push(actionToFeature(a, entry.edition, convCtx));
    } else {
      actions.push(actionToFeature(a, entry.edition, convCtx));
    }
  }

  // Traits: detect Legendary Resistance count and ALSO keep the trait itself so
  // its prose (and any 2024 lair-variant detail) renders in the TRAITS tab
  // alongside other special traits. The numeric `legendary_resistance` field
  // remains available on the runtime Monster type for game-mechanical use
  // (e.g., a future tracker UI), but it no longer drives display.
  const traits: Feature[] = [];
  let legendaryResistance: number | undefined;
  for (const t of baseTraits) {
    const lrMatch = (t.name ?? "").match(/^Legendary Resistance\s*\((\d+)\s*\/\s*Day/i);
    if (lrMatch) {
      legendaryResistance = parseInt(lrMatch[1], 10);
    }
    const rewritten = rewriteCrossRefs(t.desc ?? "", entry.edition);
    const converted = convertDescToTags(rewritten, {
      abilities: converterAbilities,
      profBonus,
      actionName: t.name,
      actionCategory: "trait",
      spellAbility,
    });
    traits.push({ name: t.name, entries: [converted] });
  }

  const out: CreatureCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    size,
    type,
    ac,
    hp,
    speed,
    abilities,
    senses,
    languages,
    damage_vulnerabilities,
    damage_resistances,
    damage_immunities,
    condition_immunities,
    actions,
    reactions,
    legendary_actions: legendary,
    traits,
  };

  if (typeof base.desc === "string" && base.desc.length > 0) {
    out.description = rewriteCrossRefs(base.desc, entry.edition);
  }
  if (cr !== undefined) out.cr = cr;
  if (Object.keys(saves).length > 0) out.saves = saves;
  if (Object.keys(skills).length > 0) out.skills = skills;
  if (typeof base.subcategory === "string" && base.subcategory.length > 0) {
    out.subtype = base.subcategory;
  }
  if (typeof base.alignment === "string" && base.alignment.length > 0) {
    out.alignment = base.alignment;
  }
  if (typeof base.passive_perception === "number") {
    out.passive_perception = base.passive_perception;
  }
  if (legendaryResistance !== undefined) {
    out.legendary_resistance = legendaryResistance;
  }

  return out;
}
