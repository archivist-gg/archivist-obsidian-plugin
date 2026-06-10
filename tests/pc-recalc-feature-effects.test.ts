import { describe, it, expect } from "vitest";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { ResolvedCharacter, ResolvedClass, ResolvedFeature } from "../src/modules/pc/pc.types";
import type { FeatureEffect } from "../src/shared/types/feature-effect";

function mkClass(slug: string, die: string, level: number): ResolvedClass {
  return {
    entity: {
      slug,
      name: slug,
      edition: "2014",
      hit_die: die,
      primary_abilities: ["str"],
      saving_throws: [],
      features_by_level: {},
    } as never,
    level,
    subclass: null,
    choices: {},
  };
}

function emptyResolved(): ResolvedCharacter {
  return {
    definition: {
      name: "T",
      edition: "2014",
      race: null,
      subrace: null,
      background: null,
      class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [],
      overrides: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
    } as never,
    race: null,
    classes: [],
    background: null,
    feats: [],
    totalLevel: 0,
    features: [],
    spells: [],
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] } as never,
  };
}

function effectFeature(effects: FeatureEffect[], name = "Effect Source"): ResolvedFeature {
  return { feature: { name, effects } as never, source: { kind: "race", slug: "test-race" } };
}

function resolvedWith(level: ResolvedClass, effects: FeatureEffect[]): ResolvedCharacter {
  const r = emptyResolved();
  r.classes = [level];
  r.features.push(effectFeature(effects));
  return r;
}

describe("recalc — feature effects: initiative / HP / speed / senses", () => {
  it("adds initiative-bonus to derived initiative", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 5), [{ kind: "initiative-bonus", value: 2 }]));
    expect(d.initiative).toBe(2); // DEX +0 + 2
  });

  it("overrides.initiative wins over feature initiative", () => {
    const r = resolvedWith(mkClass("rogue", "d8", 5), [{ kind: "initiative-bonus", value: 2 }]);
    r.definition.overrides = { initiative: 7 };
    expect(recalc(r).initiative).toBe(7);
  });

  it("adds hp-per-level-bonus × totalLevel to max HP", () => {
    // Rogue d8 L5, CON +0: 8 + 4×5 = 28 base; +1/level × 5 = 33.
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 5), [{ kind: "hp-per-level-bonus", value: 1 }]));
    expect(d.hp.max).toBe(33);
  });

  it("overrides.hp.max wins over feature HP bonus", () => {
    const r = resolvedWith(mkClass("rogue", "d8", 5), [{ kind: "hp-per-level-bonus", value: 1 }]);
    r.definition.overrides = { hp: { max: 50 } };
    expect(recalc(r).hp.max).toBe(50);
  });

  it("adds walk speed-bonus and ignores fly mode", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 1), [
      { kind: "speed-bonus", mode: "walk", value: 10 },
      { kind: "speed-bonus", mode: "fly", value: 30 },
    ]));
    expect(d.speed).toBe(40); // 30 default + 10
  });

  it("overrides.speed wins over feature speed bonus", () => {
    const r = resolvedWith(mkClass("rogue", "d8", 1), [{ kind: "speed-bonus", mode: "walk", value: 10 }]);
    r.definition.overrides = { speed: 15 };
    expect(recalc(r).speed).toBe(15);
  });

  it("senses.darkvision comes from effects when race has none", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 1), [{ kind: "darkvision", range: 60 }]));
    expect(d.senses.darkvision).toBe(60);
  });

  it("senses.darkvision takes the max of race vision and effects", () => {
    const r = resolvedWith(mkClass("rogue", "d8", 1), [{ kind: "darkvision", range: 60 }]);
    r.race = { slug: "drow", name: "Drow", speed: { walk: 30 }, vision: { darkvision: 120 } } as never;
    expect(recalc(r).senses.darkvision).toBe(120);
  });

  it("senses.darkvision is 0 with no race vision and no effects", () => {
    const r = emptyResolved();
    r.classes = [mkClass("rogue", "d8", 1)];
    expect(recalc(r).senses.darkvision).toBe(0);
  });
});

describe("recalc — feature effects: proficiencies", () => {
  it("proficiency skill effect makes the skill proficient", () => {
    // L5 → prof +3; WIS 10 → mod 0; proficient Perception bonus = 3.
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 5), [
      { kind: "proficiency", proficiency_type: "skill", value: "Perception" },
    ]));
    expect(d.skills.perception.proficiency).toBe("proficient");
    expect(d.skills.perception.bonus).toBe(3);
  });

  it("skill override still wins over a feature skill proficiency", () => {
    const r = resolvedWith(mkClass("rogue", "d8", 5), [
      { kind: "proficiency", proficiency_type: "skill", value: "Perception" },
    ]);
    r.definition.overrides = { skills: { perception: { bonus: 0, proficiency: "none" } } };
    const d = recalc(r);
    expect(d.skills.perception.proficiency).toBe("none");
    expect(d.skills.perception.bonus).toBe(0);
  });

  it("proficiency saving-throw effect marks the save proficient", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 5), [
      { kind: "proficiency", proficiency_type: "saving-throw", value: "Wisdom" },
    ]));
    expect(d.saves.wis.proficient).toBe(true);
    expect(d.saves.wis.bonus).toBe(3); // mod 0 + prof 3
    expect(d.saves.str.proficient).toBe(false);
  });

  it("proficiency tool and language effects land in the proficiency sets", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 1), [
      { kind: "proficiency", proficiency_type: "tool", value: "Thieves' Tools" },
      { kind: "proficiency", proficiency_type: "language", value: "Draconic" },
    ]));
    expect(d.proficiencies.tools.specific).toContain("Thieves' Tools");
    expect(d.proficiencies.languages).toContain("Draconic");
  });
});

describe("recalc — feature effects: defenses", () => {
  it("appends feature resistances to derived defenses", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 1), [
      { kind: "resistance", damage_type: "Fire" },
      { kind: "resistance", damage_type: "Cold" },
    ]));
    expect(d.defenses.resistances).toEqual(["Fire", "Cold"]);
  });

  it("dedupes resistances case-insensitively across manual + feature sources (manual spelling wins)", () => {
    const r = resolvedWith(mkClass("rogue", "d8", 1), [{ kind: "resistance", damage_type: "Fire" }]);
    r.definition.defenses = { resistances: ["fire"], immunities: [], vulnerabilities: [], condition_immunities: [] };
    const d = recalc(r);
    expect(d.defenses.resistances).toEqual(["fire"]);
  });

  it("applies ungated immune-condition to condition immunities and skips while-gated", () => {
    const d = recalc(resolvedWith(mkClass("rogue", "d8", 1), [
      { kind: "immune-condition", condition: "Charmed" },
      { kind: "immune-condition", condition: "Frightened", while: "while raging" },
    ]));
    expect(d.defenses.condition_immunities).toEqual(["Charmed"]);
  });

  it("dedupes manual duplicate defense entries (pre-existing concat bug)", () => {
    const r = emptyResolved();
    r.classes = [mkClass("rogue", "d8", 1)];
    r.definition.defenses = { resistances: ["Fire", "fire"], immunities: [], vulnerabilities: [], condition_immunities: [] };
    expect(recalc(r).defenses.resistances).toEqual(["Fire"]);
  });
});
