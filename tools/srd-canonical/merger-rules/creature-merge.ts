import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import type { Attack } from "../../../src/shared/types/attack";
import type { Feature } from "../../../src/shared/types/feature";

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

function actionToFeature(action: Open5eAction, edition: "2014" | "2024"): Feature {
  const f: Feature = {
    name: action.name,
    entries: [rewriteCrossRefs(action.desc ?? "", edition)],
  };
  if (action.attacks && action.attacks.length > 0) {
    f.attacks = action.attacks.map(open5eAttackToAttack);
  }
  return f;
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
  if (typeof base.passive_perception === "number") {
    senses.push(`passive Perception ${base.passive_perception}`);
  }
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

  // Actions split by action_type.
  const allActions = (Array.isArray(base.actions) ? (base.actions as Open5eAction[]) : []);
  const actions: Feature[] = [];
  const reactions: Feature[] = [];
  const legendary: Feature[] = [];

  for (const a of allActions) {
    if (a.action_type === "REACTION") {
      reactions.push(actionToFeature(a, entry.edition));
    } else if (a.action_type === "LEGENDARY_ACTION") {
      legendary.push(actionToFeature(a, entry.edition));
    } else {
      actions.push(actionToFeature(a, entry.edition));
    }
  }

  // Traits: detect Legendary Resistance count and emit as separate field.
  const baseTraits = (Array.isArray(base.traits) ? (base.traits as Open5eTrait[]) : []);
  const traits: Feature[] = [];
  let legendaryResistance: number | undefined;
  for (const t of baseTraits) {
    const lrMatch = (t.name ?? "").match(/^Legendary Resistance\s*\((\d+)\s*\/\s*Day/i);
    if (lrMatch) {
      legendaryResistance = parseInt(lrMatch[1], 10);
      // Drop this trait from traits[]; structured field carries the count.
      continue;
    }
    traits.push({
      name: t.name,
      entries: [rewriteCrossRefs(t.desc ?? "", entry.edition)],
    });
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
