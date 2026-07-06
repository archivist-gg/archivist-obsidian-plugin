import type { Ability } from "@archivist/dnd5e";
import type { KnownSpellEntry, ResolvedClass } from "./pc.types";
import { abilityModifier } from "@archivist/dnd5e/dnd/math";
import type { CasterType } from "@archivist/dnd5e/class/class.types";
import { bareSlug } from "@archivist/dnd5e/class/class.slug";
import { readTableColumn } from "./pc.table-column";

export interface SpellcastingProfile {
  ability: Ability;
  casterType: CasterType;
  preparation: "known" | "prepared";
  spellList: string;
  table: Record<number, { columns?: Record<string, string | number> }>;
}

/**
 * Data-driven spellcasting profile for a resolved class. Reads the subclass
 * block if the subclass grants casting (e.g. Architect of Ruin), else the class
 * block. Known/cantrip columns come from whichever entity grants casting
 * (subclass table preferred, falling back to the class table). Returns null for
 * non-casters. No hardcoded class knowledge — everything comes from the data.
 */
export function resolveSpellcasting(rc: ResolvedClass): SpellcastingProfile | null {
  const sub = rc.subclass?.spellcasting ?? null;
  const cls = rc.entity?.spellcasting ?? null;
  const sc = sub ?? cls;
  if (!sc) return null;
  const table = (sub ? rc.subclass?.table : rc.entity?.table) ?? rc.entity?.table ?? {};
  return {
    ability: sc.ability,
    casterType: sc.caster_type,
    preparation: sc.preparation,
    spellList: sc.spell_list,
    table,
  };
}

export interface NormalizedKnownSpell {
  slug: string;            // bare slug, brackets stripped
  classSlug: string | null;
  source: "class" | "feat" | "item" | "race" | "domain";
  preparedFlag: boolean | undefined; // undefined when entry didn't specify
  alwaysPrepared: boolean;
}

export function normalizeKnownSpell(entry: KnownSpellEntry): NormalizedKnownSpell {
  if (typeof entry === "string") {
    return { slug: bareSlug(entry), classSlug: null, source: "class", preparedFlag: undefined, alwaysPrepared: false };
  }
  return {
    slug: bareSlug(entry.spell),
    classSlug: entry.class ? bareSlug(entry.class) : null,
    source: entry.source ?? "class",
    preparedFlag: entry.prepared,
    alwaysPrepared: entry.always_prepared ?? false,
  };
}

export interface CasterClassInput {
  casterType: CasterType;
  level: number;
}

export interface DerivedSpellSlots {
  /** spell level (1..9) → total slots. Levels with 0 slots are omitted. */
  standard: Record<number, number>;
  /** Warlock Pact Magic, or null. */
  pact: { level: number; total: number } | null;
}

// Standard full-caster / multiclass slot table. Index = caster level (1..20);
// each row is slots for spell levels 1..9. Edition-independent.
const FULL_CASTER_SLOTS: number[][] = [
  /* 1  */ [2, 0, 0, 0, 0, 0, 0, 0, 0],
  /* 2  */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
  /* 3  */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
  /* 4  */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
  /* 5  */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* 6  */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* 7  */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
  /* 8  */ [4, 3, 3, 2, 0, 0, 0, 0, 0],
  /* 9  */ [4, 3, 3, 3, 1, 0, 0, 0, 0],
  /* 10 */ [4, 3, 3, 3, 2, 0, 0, 0, 0],
  /* 11 */ [4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* 12 */ [4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* 13 */ [4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* 14 */ [4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* 15 */ [4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* 16 */ [4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* 17 */ [4, 3, 3, 3, 2, 1, 1, 1, 1],
  /* 18 */ [4, 3, 3, 3, 3, 1, 1, 1, 1],
  /* 19 */ [4, 3, 3, 3, 3, 2, 1, 1, 1],
  /* 20 */ [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

// Single-class half caster (Paladin / Ranger). Index = class level (1..20);
// spell levels 1..5. Edition-independent.
const HALF_CASTER_SLOTS: number[][] = [
  /* 1  */ [0, 0, 0, 0, 0],
  /* 2  */ [2, 0, 0, 0, 0],
  /* 3  */ [3, 0, 0, 0, 0],
  /* 4  */ [3, 0, 0, 0, 0],
  /* 5  */ [4, 2, 0, 0, 0],
  /* 6  */ [4, 2, 0, 0, 0],
  /* 7  */ [4, 3, 0, 0, 0],
  /* 8  */ [4, 3, 0, 0, 0],
  /* 9  */ [4, 3, 2, 0, 0],
  /* 10 */ [4, 3, 2, 0, 0],
  /* 11 */ [4, 3, 3, 0, 0],
  /* 12 */ [4, 3, 3, 0, 0],
  /* 13 */ [4, 3, 3, 1, 0],
  /* 14 */ [4, 3, 3, 1, 0],
  /* 15 */ [4, 3, 3, 2, 0],
  /* 16 */ [4, 3, 3, 2, 0],
  /* 17 */ [4, 3, 3, 3, 1],
  /* 18 */ [4, 3, 3, 3, 1],
  /* 19 */ [4, 3, 3, 3, 2],
  /* 20 */ [4, 3, 3, 3, 2],
];

// Dedicated single-class one-third caster table (Eldritch Knight / Arcane Trickster /
// Architect of Ruin). NOT floor(level/3) of the full table — that is wrong (yields 3
// first-level slots at L7 instead of the correct 4/2). Index = class level (1..20);
// spell levels 1..4.
const THIRD_CASTER_SLOTS: number[][] = [
  /* 1  */ [0, 0, 0, 0],
  /* 2  */ [0, 0, 0, 0],
  /* 3  */ [2, 0, 0, 0],
  /* 4  */ [3, 0, 0, 0],
  /* 5  */ [3, 0, 0, 0],
  /* 6  */ [3, 0, 0, 0],
  /* 7  */ [4, 2, 0, 0],
  /* 8  */ [4, 2, 0, 0],
  /* 9  */ [4, 2, 0, 0],
  /* 10 */ [4, 3, 0, 0],
  /* 11 */ [4, 3, 0, 0],
  /* 12 */ [4, 3, 0, 0],
  /* 13 */ [4, 3, 2, 0],
  /* 14 */ [4, 3, 2, 0],
  /* 15 */ [4, 3, 2, 0],
  /* 16 */ [4, 3, 3, 0],
  /* 17 */ [4, 3, 3, 0],
  /* 18 */ [4, 3, 3, 0],
  /* 19 */ [4, 3, 3, 1],
  /* 20 */ [4, 3, 3, 1],
];

// Warlock Pact Magic: warlock level → { slot level, slot count }.
const PACT_MAGIC: Array<{ level: number; total: number }> = [
  /* 1  */ { level: 1, total: 1 },
  /* 2  */ { level: 1, total: 2 },
  /* 3  */ { level: 2, total: 2 },
  /* 4  */ { level: 2, total: 2 },
  /* 5  */ { level: 3, total: 2 },
  /* 6  */ { level: 3, total: 2 },
  /* 7  */ { level: 4, total: 2 },
  /* 8  */ { level: 4, total: 2 },
  /* 9  */ { level: 5, total: 2 },
  /* 10 */ { level: 5, total: 2 },
  /* 11 */ { level: 5, total: 3 },
  /* 12 */ { level: 5, total: 3 },
  /* 13 */ { level: 5, total: 3 },
  /* 14 */ { level: 5, total: 3 },
  /* 15 */ { level: 5, total: 3 },
  /* 16 */ { level: 5, total: 3 },
  /* 17 */ { level: 5, total: 4 },
  /* 18 */ { level: 5, total: 4 },
  /* 19 */ { level: 5, total: 4 },
  /* 20 */ { level: 5, total: 4 },
];

function rowToRecord(row: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  row.forEach((n, i) => { if (n > 0) out[i + 1] = n; });
  return out;
}

export function deriveSpellSlots(classes: CasterClassInput[]): DerivedSpellSlots {
  let fullLevels = 0, halfLevels = 0, thirdLevels = 0, warlockLevel = 0;
  const regular: Array<{ caster: Exclude<CasterType, "pact">; level: number }> = [];
  for (const c of classes) {
    if (c.casterType === "pact") { warlockLevel += c.level; continue; }
    regular.push({ caster: c.casterType, level: c.level });
    if (c.casterType === "full") fullLevels += c.level;
    else if (c.casterType === "half") halfLevels += c.level;
    else if (c.casterType === "third") thirdLevels += c.level;
  }

  let standard: Record<number, number> = {};
  if (regular.length === 1) {
    const only = regular[0];
    const idx = only.level - 1;
    if (only.caster === "half") {
      if (idx >= 0 && idx < HALF_CASTER_SLOTS.length) standard = rowToRecord(HALF_CASTER_SLOTS[idx]);
    } else if (only.caster === "third") {
      if (idx >= 0 && idx < THIRD_CASTER_SLOTS.length) standard = rowToRecord(THIRD_CASTER_SLOTS[idx]);
    } else {
      if (only.level >= 1 && only.level <= FULL_CASTER_SLOTS.length) standard = rowToRecord(FULL_CASTER_SLOTS[only.level - 1]);
    }
  } else if (regular.length >= 2) {
    const cl = fullLevels + Math.floor(halfLevels / 2) + Math.floor(thirdLevels / 3);
    if (cl >= 1 && cl <= FULL_CASTER_SLOTS.length) standard = rowToRecord(FULL_CASTER_SLOTS[cl - 1]);
  }

  const pact = warlockLevel >= 1 && warlockLevel <= PACT_MAGIC.length ? PACT_MAGIC[warlockLevel - 1] : null;
  return { standard, pact };
}

export interface LimitClassInput {
  classSlug: string;
  level: number;
  profile: SpellcastingProfile;
  /** Ability score for this class's spellcasting ability. */
  abilityScore: number;
}

export interface SpellLimit {
  classSlug: string;
  kind: "known" | "prepared";
  cantripsKnown: number | null;     // null = unknown / not shown
  preparedOrKnown: number | null;
}

export function computeSpellLimits(inputs: LimitClassInput[]): SpellLimit[] {
  const out: SpellLimit[] = [];
  for (const i of inputs) {
    const p = i.profile;
    const cantripsKnown = readTableColumn(p.table, i.level, ["Cantrips Known", "Cantrips"]);
    const mod = abilityModifier(i.abilityScore);
    let preparedOrKnown: number | null;
    if (p.preparation === "prepared") {
      const levelTerm = p.casterType === "half" ? Math.floor(i.level / 2) : i.level;
      preparedOrKnown = Math.max(1, mod + levelTerm);
    } else {
      preparedOrKnown = readTableColumn(p.table, i.level, ["Spells Known", "Prepared Spells"]);
    }
    out.push({ classSlug: i.classSlug, kind: p.preparation, cantripsKnown, preparedOrKnown });
  }
  return out;
}
