import { describe, it, expect } from "vitest";
import { recalc } from "../packages/obsidian/src/modules/pc/pc.recalc";
import type { ResolvedCharacter, ResolvedClass } from "../packages/obsidian/src/modules/pc/pc.types";
import cls2014 from "../packages/dnd5e/src/srd/data/runtime/class.2014.json";
import cls2024 from "../packages/dnd5e/src/srd/data/runtime/class.2024.json";

// ─────────────────────────────────────────────────────────────────────────────
// Full SRD spellcasting-parity REGRESSION GUARD (plan correction W1, Task 10).
//
// Stage 3a (effect kinds, senses migration, AC/attack annotations, activatable
// buffs) touched pc.recalc.ts + DerivedStats but NOT the spellcasting math:
//   • src/modules/pc/pc.spellcasting.ts is byte-identical to pre-3a `main`
//     (git diff 9f68d51..HEAD -- pc.spellcasting.ts is EMPTY), and
//   • the recalc spellcasting block (saveDC/attackBonus/deriveSpellSlots/
//     computeSpellLimits → derivedSpellSlots/pactMagic/spellLimits, lines ~764-799)
//     has no +/- lines in the 3a diff. The lone `resolveSpellcasting(c)` the diff
//     adds is in the new weapon-ability/buff fold (reads only the caster ability,
//     not the slot/DC machinery).
//
// This test PROVES the derived spellcasting OUTPUT is unchanged going into 3b/3c,
// for all 8 SRD casters × {2014, 2024} × representative levels {1, 5, 11, 17}.
// Expected values are INLINE (captured from the current green build) so any break
// shows a human-readable diff pointing at the exact caster/edition/level cell.
//
// Each caster's spellcasting ability score is set to 16 (mod +3); proficiency is
// added by level (recalc runs without a registry, so applied bonuses are 0 — the
// derived DC/attack are pure ability + proficiency, exactly like the existing
// pc-recalc-spellcasting.test.ts). Built the SAME way that test builds casters,
// but with the REAL SRD class entity so resolveSpellcasting reads the real
// spellcasting block + table (cantrips known / spells known columns).
//
// caster-type nuances captured (not assumed): paladin/ranger are HALF-casters
// (no slots at L1 — they start at L2: slots {} captured for both editions);
// warlock uses Pact Magic (pact:{level,total}, standard slots {} ).
// ─────────────────────────────────────────────────────────────────────────────

const arr = (d: unknown): Array<{ slug: string }> =>
  (Array.isArray(d) ? d : Object.values(d as object)) as Array<{ slug: string }>;
const findEntity = (d: unknown, slug: string): { slug: string } => {
  const hit = arr(d).find((c) => c.slug === slug || c.slug.endsWith(`_${slug}`));
  if (!hit) throw new Error(`class not found: ${slug}`);
  return hit;
};

// Spellcasting ability per caster (mirrors srd-spellcasting-parity config).
const ABILITY: Record<string, string> = {
  bard: "cha", cleric: "wis", druid: "wis", paladin: "cha",
  ranger: "wis", sorcerer: "cha", warlock: "cha", wizard: "int",
};

const data = (ed: "2014" | "2024") => (ed === "2014" ? cls2014 : cls2024);

/**
 * Build a ResolvedCharacter the SAME way pc-recalc-spellcasting.test.ts does
 * (single class, manual abilities, no registry), but with the REAL SRD class
 * entity. The caster's spell ability is set to 16 (mod +3); all others 10.
 */
function buildCaster(slug: string, ed: "2014" | "2024", level: number): ResolvedCharacter {
  const entity = findEntity(data(ed), slug);
  const rc: ResolvedClass = { entity: entity as never, level, subclass: null, choices: {} };
  const ability = ABILITY[slug];
  const scores: Record<string, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, [ability]: 16 };
  const def = {
    name: "T", edition: ed, race: null, subrace: null, background: null,
    class: [{ name: entity.slug, level, subclass: null, choices: {} }],
    abilities: scores,
    ability_method: "manual" as const, skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  };
  return {
    definition: def as never, race: null, classes: [rc], background: null, feats: [],
    totalLevel: level, features: [], spells: [], pools: [], state: def.state as never,
  };
}

/** The derived spellcasting numbers this guard locks in, per cell. */
interface Cell {
  slots: Record<number, number>;
  pact: { level: number; total: number } | null;
  cantrips: number | null;
  preparedOrKnown: number | null;
  kind: "known" | "prepared";
  saveDC: number;
  attackBonus: number;
  ability: string;
}

// Inline expected values, captured from the current (post-3a) green build.
// Structure: EXPECTED[edition][caster][level] → Cell. A future break points at
// the exact [edition][caster][level] cell.
//
// To RE-CAPTURE after a *legitimate* spellcasting change (e.g. a 3b/3c rules
// update): run each `buildCaster(slug, ed, level)` through `recalc` and read the
// derived `derivedSpellSlots` / `pactMagic` / `spellLimits[0]` /
// `spellcastingClasses[0]` numbers off the green build, then update the
// affected cell(s) here. Do NOT compute expected values from the same code path
// under test — that would defeat the parity guard. The sanity anchors below
// (derived from first principles) catch an obviously-wrong recapture.
const EXPECTED: Record<"2014" | "2024", Record<string, Record<number, Cell>>> = {
  "2014": {
    bard: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 2, preparedOrKnown: 4, kind: "known", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 3, preparedOrKnown: 8, kind: "known", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 4, preparedOrKnown: 15, kind: "known", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 4, preparedOrKnown: 20, kind: "known", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    cleric: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 3, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "wis" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 4, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "wis" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 5, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "wis" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 5, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "wis" },
    },
    druid: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 2, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "wis" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 3, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "wis" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 4, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "wis" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 4, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "wis" },
    },
    // Half-caster: NO slots at L1 (starts at L2). No cantrips column.
    paladin: {
      1:  { slots: {}, pact: null, cantrips: null, preparedOrKnown: 3, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: { 1: 4, 2: 2 }, pact: null, cantrips: null, preparedOrKnown: 5, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: { 1: 4, 2: 3, 3: 3 }, pact: null, cantrips: null, preparedOrKnown: 8, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, pact: null, cantrips: null, preparedOrKnown: 11, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    // Half-caster, 2014 "known": L1 has no Spells Known column → null.
    ranger: {
      1:  { slots: {}, pact: null, cantrips: null, preparedOrKnown: null, kind: "known", saveDC: 13, attackBonus: 5, ability: "wis" },
      5:  { slots: { 1: 4, 2: 2 }, pact: null, cantrips: null, preparedOrKnown: 4, kind: "known", saveDC: 14, attackBonus: 6, ability: "wis" },
      11: { slots: { 1: 4, 2: 3, 3: 3 }, pact: null, cantrips: null, preparedOrKnown: 7, kind: "known", saveDC: 15, attackBonus: 7, ability: "wis" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, pact: null, cantrips: null, preparedOrKnown: 10, kind: "known", saveDC: 17, attackBonus: 9, ability: "wis" },
    },
    sorcerer: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 4, preparedOrKnown: 2, kind: "known", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 5, preparedOrKnown: 6, kind: "known", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 6, preparedOrKnown: 12, kind: "known", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 6, preparedOrKnown: 15, kind: "known", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    // Pact Magic: standard slots {}, pact {level,total}.
    warlock: {
      1:  { slots: {}, pact: { level: 1, total: 1 }, cantrips: 2, preparedOrKnown: 2, kind: "known", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: {}, pact: { level: 3, total: 2 }, cantrips: 3, preparedOrKnown: 6, kind: "known", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: {}, pact: { level: 5, total: 3 }, cantrips: 4, preparedOrKnown: 11, kind: "known", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: {}, pact: { level: 5, total: 4 }, cantrips: 4, preparedOrKnown: 14, kind: "known", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    wizard: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 3, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "int" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 4, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "int" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 5, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "int" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 5, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "int" },
    },
  },
  "2024": {
    // 2024: bard becomes "prepared" (count = mod + level, not a table column).
    bard: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 2, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 3, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 4, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 4, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    cleric: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 3, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "wis" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 4, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "wis" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 5, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "wis" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 5, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "wis" },
    },
    druid: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 2, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "wis" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 2, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "wis" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 3, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "wis" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 4, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "wis" },
    },
    paladin: {
      1:  { slots: {}, pact: null, cantrips: null, preparedOrKnown: 3, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: { 1: 4, 2: 2 }, pact: null, cantrips: null, preparedOrKnown: 5, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: { 1: 4, 2: 3, 3: 3 }, pact: null, cantrips: null, preparedOrKnown: 8, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, pact: null, cantrips: null, preparedOrKnown: 11, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    // 2024: ranger becomes "prepared" (count = mod + floor(level/2)).
    ranger: {
      1:  { slots: {}, pact: null, cantrips: null, preparedOrKnown: 3, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "wis" },
      5:  { slots: { 1: 4, 2: 2 }, pact: null, cantrips: null, preparedOrKnown: 5, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "wis" },
      11: { slots: { 1: 4, 2: 3, 3: 3 }, pact: null, cantrips: null, preparedOrKnown: 8, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "wis" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, pact: null, cantrips: null, preparedOrKnown: 11, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "wis" },
    },
    sorcerer: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 4, preparedOrKnown: 2, kind: "known", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 5, preparedOrKnown: 9, kind: "known", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 6, preparedOrKnown: 16, kind: "known", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 6, preparedOrKnown: 19, kind: "known", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    warlock: {
      1:  { slots: {}, pact: { level: 1, total: 1 }, cantrips: 2, preparedOrKnown: 2, kind: "known", saveDC: 13, attackBonus: 5, ability: "cha" },
      5:  { slots: {}, pact: { level: 3, total: 2 }, cantrips: 3, preparedOrKnown: 6, kind: "known", saveDC: 14, attackBonus: 6, ability: "cha" },
      11: { slots: {}, pact: { level: 5, total: 3 }, cantrips: 4, preparedOrKnown: 11, kind: "known", saveDC: 15, attackBonus: 7, ability: "cha" },
      17: { slots: {}, pact: { level: 5, total: 4 }, cantrips: 4, preparedOrKnown: 14, kind: "known", saveDC: 17, attackBonus: 9, ability: "cha" },
    },
    wizard: {
      1:  { slots: { 1: 2 }, pact: null, cantrips: 3, preparedOrKnown: 4, kind: "prepared", saveDC: 13, attackBonus: 5, ability: "int" },
      5:  { slots: { 1: 4, 2: 3, 3: 2 }, pact: null, cantrips: 4, preparedOrKnown: 8, kind: "prepared", saveDC: 14, attackBonus: 6, ability: "int" },
      11: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, pact: null, cantrips: 5, preparedOrKnown: 14, kind: "prepared", saveDC: 15, attackBonus: 7, ability: "int" },
      17: { slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null, cantrips: 5, preparedOrKnown: 20, kind: "prepared", saveDC: 17, attackBonus: 9, ability: "int" },
    },
  },
};

const CASTERS = Object.keys(EXPECTED["2014"]); // 8 SRD casters
const EDITIONS: Array<"2014" | "2024"> = ["2014", "2024"];
const LEVELS = [1, 5, 11, 17];

describe("SRD spellcasting parity — full derived numbers (8 casters × 2 editions × 4 levels)", () => {
  for (const ed of EDITIONS) {
    for (const slug of CASTERS) {
      for (const level of LEVELS) {
        const exp = EXPECTED[ed][slug][level];
        // One assertion bundle per cell — failure name points at the exact cell.
        it(`${slug} ${ed} L${level}: slots/cantrips/${exp.kind}/DC/attack`, () => {
          const d = recalc(buildCaster(slug, ed, level));
          const sc = d.spellcastingClasses[0];
          const lim = d.spellLimits[0];

          const actual: Cell = {
            slots: d.derivedSpellSlots,
            pact: d.pactMagic,
            cantrips: lim?.cantripsKnown ?? null,
            preparedOrKnown: lim?.preparedOrKnown ?? null,
            kind: lim?.kind as "known" | "prepared",
            saveDC: sc?.saveDC ?? -1,
            attackBonus: sc?.attackBonus ?? -1,
            ability: sc?.ability ?? "",
          };
          // Single deep-equal so the failure prints the full expected-vs-actual
          // cell — making a regression's exact field obvious.
          expect(actual).toEqual(exp);
        });
      }
    }
  }

  // Sanity anchors so an obviously-wrong capture can't silently pass.
  it("sanity: L5 wizard (INT 16) slots are {1:4, 2:3, 3:2} in both editions", () => {
    expect(recalc(buildCaster("wizard", "2014", 5)).derivedSpellSlots).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(recalc(buildCaster("wizard", "2024", 5)).derivedSpellSlots).toEqual({ 1: 4, 2: 3, 3: 2 });
  });
  it("sanity: cleric save DC from WIS 16 = 8 + prof + 3 (13 @L1, 14 @L5, 17 @L17)", () => {
    expect(recalc(buildCaster("cleric", "2014", 1)).spellcastingClasses[0].saveDC).toBe(13);
    expect(recalc(buildCaster("cleric", "2014", 5)).spellcastingClasses[0].saveDC).toBe(14);
    expect(recalc(buildCaster("cleric", "2014", 17)).spellcastingClasses[0].saveDC).toBe(17);
  });
  it("sanity: half-casters have NO standard slots at L1 (paladin & ranger, both editions)", () => {
    for (const ed of EDITIONS) {
      expect(recalc(buildCaster("paladin", ed, 1)).derivedSpellSlots).toEqual({});
      expect(recalc(buildCaster("ranger", ed, 1)).derivedSpellSlots).toEqual({});
    }
  });
  it("sanity: warlock uses Pact Magic (no standard slots; L5 → 2 slots @ lvl 3)", () => {
    const w = recalc(buildCaster("warlock", "2014", 5));
    expect(w.derivedSpellSlots).toEqual({});
    expect(w.pactMagic).toEqual({ level: 3, total: 2 });
  });
});
