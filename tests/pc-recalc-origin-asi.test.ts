import { describe, it, expect } from "vitest";
import { collectChosenAbilityPoints } from "../src/modules/pc/pc.decision-engine";
import { computeAbilityScores, abilityBonusBreakdown } from "../src/modules/pc/pc.recalc";
import type { ResolvedCharacter } from "../src/modules/pc/pc.types";

function resolvedWith(over: Record<string, unknown>): ResolvedCharacter {
  return {
    definition: {
      name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [], overrides: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
      ...((over.definition as object) ?? {}),
    },
    race: (over.race as never) ?? null,
    classes: [], background: (over.background as never) ?? null,
    feats: [], totalLevel: 0, features: [], spells: [],
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
  } as unknown as ResolvedCharacter;
}

const BG_2024 = {
  slug: "srd-2024_criminal", name: "Criminal",
  choices: [{ kind: "ability-points", id: "asi", points: 3, max_per: 2, pool: ["dex", "con", "int"] }],
} as never;

const RACE_WITH_CHOICE = {
  slug: "srd-5e_half-elf", name: "Half-Elf",
  ability_score_increases: [{ ability: "cha", amount: 2 }],
  choices: [{ kind: "ability-points", id: "half-elf-asi", points: 2, max_per: 1, pool: ["str", "dex", "con", "int", "wis"] }],
} as never;

describe("collectChosenAbilityPoints", () => {
  it("collects background ability-points from the namespaced origin choice", () => {
    const r = resolvedWith({
      background: BG_2024,
      definition: { origin_choices: { "background:asi": { dex: 2, con: 1 } } },
    });
    expect(collectChosenAbilityPoints(r)).toEqual({ race: {}, background: { dex: 2, con: 1 } });
  });

  it("collects race choice-ASI and clamps per max_per and total points", () => {
    const r = resolvedWith({
      race: RACE_WITH_CHOICE,
      definition: { origin_choices: { "race:half-elf-asi": { str: 3, dex: 1, con: 1 } } },
    });
    // max_per 1 clamps str 3→1; points 2 stops the fold after str+dex.
    expect(collectChosenAbilityPoints(r)).toEqual({ race: { str: 1, dex: 1 }, background: {} });
  });

  it("ignores malformed values without throwing", () => {
    const r = resolvedWith({
      background: BG_2024,
      definition: { origin_choices: { "background:asi": "not-an-object" } },
    });
    expect(collectChosenAbilityPoints(r)).toEqual({ race: {}, background: {} });
  });

  it("ignores allocations to an ability outside the choice's pool", () => {
    // BG_2024's pool is [dex, con, int]; a hand-edited str allocation must not
    // fold, while in-pool dex still does.
    const r = resolvedWith({
      background: BG_2024,
      definition: { origin_choices: { "background:asi": { str: 2, dex: 1 } } },
    });
    expect(collectChosenAbilityPoints(r)).toEqual({ race: {}, background: { dex: 1 } });
  });
});

describe("computeAbilityScores — origin folds", () => {
  it("adds background ability-points to the totals", () => {
    const r = resolvedWith({
      background: BG_2024,
      definition: { origin_choices: { "background:asi": { dex: 2, con: 1 } } },
    });
    const out = computeAbilityScores(r, {});
    expect(out.dex).toBe(12);
    expect(out.con).toBe(11);
  });

  it("adds subrace fixed ASI matched by slug", () => {
    const r = resolvedWith({
      race: {
        slug: "srd-5e_dwarf", name: "Dwarf",
        ability_score_increases: [{ ability: "con", amount: 2 }],
        subraces: [{ slug: "hill-dwarf", name: "Hill Dwarf", ability_score_increases: [{ ability: "wis", amount: 1 }] }],
      } as never,
      definition: { subrace: "[[hill-dwarf]]" },
    });
    const out = computeAbilityScores(r, {});
    expect(out.con).toBe(12);
    expect(out.wis).toBe(11);
  });

  it("overrides.scores still win over origin folds", () => {
    const r = resolvedWith({
      background: BG_2024,
      definition: { origin_choices: { "background:asi": { dex: 2 } } },
    });
    expect(computeAbilityScores(r, { scores: { dex: 8 } }).dex).toBe(8);
  });
});

describe("abilityBonusBreakdown", () => {
  it("splits species vs background bonuses per ability", () => {
    const r = resolvedWith({
      race: RACE_WITH_CHOICE,
      background: BG_2024,
      definition: { origin_choices: { "race:half-elf-asi": { str: 1, dex: 1 }, "background:asi": { dex: 2, con: 1 } } },
    });
    const b = abilityBonusBreakdown(r);
    expect(b.cha).toEqual({ species: 2, background: 0 }); // fixed race ASI
    expect(b.str).toEqual({ species: 1, background: 0 }); // race choice points
    expect(b.dex).toEqual({ species: 1, background: 2 }); // both
    expect(b.con).toEqual({ species: 0, background: 1 });
  });
});
