import { describe, it, expect } from "vitest";
import {
  recalc,
  multiclassMaxHP,
  phbAverageForDie,
  parseDieSize,
  unarmoredAC,
  initiativeBonus,
  speedFromRace,
  computeAbilityScores,
} from "../src/modules/pc/pc.recalc";
import type { ResolvedCharacter, ResolvedClass } from "../src/modules/pc/pc.types";

describe("parseDieSize", () => {
  it("parses d-prefixed string", () => expect(parseDieSize("d8")).toBe(8));
  it("parses bare number string", () => expect(parseDieSize("8")).toBe(8));
  it("passes through number", () => expect(parseDieSize(10)).toBe(10));
  it("returns null for null/undefined", () => {
    expect(parseDieSize(null)).toBeNull();
    expect(parseDieSize(undefined)).toBeNull();
  });
});

describe("phbAverageForDie", () => {
  it("d6 → 4", () => expect(phbAverageForDie("d6")).toBe(4));
  it("d8 → 5", () => expect(phbAverageForDie("d8")).toBe(5));
  it("d10 → 6", () => expect(phbAverageForDie("d10")).toBe(6));
  it("d12 → 7", () => expect(phbAverageForDie("d12")).toBe(7));
});

describe("multiclassMaxHP", () => {
  const rogue = mkClass("rogue", "d8", 5);
  const fighter = mkClass("fighter", "d10", 3);
  const wiz = mkClass("wizard", "d6", 2);

  it("single class rogue 5, CON +2: 10 + (5+2)*4 = 38", () => {
    expect(multiclassMaxHP([mkClass("rogue", "d8", 5)], 2)).toBe(38);
  });
  it("rogue 5 / fighter 3, CON +2: 10 + 7*4 + 8*3 = 62", () => {
    expect(multiclassMaxHP([rogue, fighter], 2)).toBe(62);
  });
  it("rogue 5 / wiz 2, CON +0: 8 + 5*4 + 4*2 = 36", () => {
    expect(multiclassMaxHP([rogue, wiz], 0)).toBe(36);
  });
  it("empty classes → 1 minimum", () => {
    expect(multiclassMaxHP([], 0)).toBe(1);
  });
  it("null class entity contributes 0", () => {
    const missing: ResolvedClass = { entity: null, level: 5, subclass: null, choices: {} };
    expect(multiclassMaxHP([missing], 2)).toBe(1);
  });
});

describe("unarmoredAC", () => {
  const mods = { str: 0, dex: 3, con: 2, int: 0, wis: 2, cha: 0 };
  it("default = 10 + DEX", () => {
    const resolved = emptyResolved();
    expect(unarmoredAC(resolved, mods, [])).toBe(13);
  });
  it("structured flag Monk → 10 + DEX + WIS", () => {
    const resolved = emptyResolved();
    resolved.features.push({
      feature: { name: "Unarmored Defense", unarmored_defense: { ability: "wis" } } as never,
      source: { kind: "class", slug: "monk", level: 1 },
    });
    expect(unarmoredAC(resolved, mods, [])).toBe(15);
  });
  it("name heuristic Barbarian → 10 + DEX + CON with warning", () => {
    const resolved = emptyResolved();
    resolved.features.push({
      feature: { name: "Unarmored Defense" } as never,
      source: { kind: "class", slug: "barbarian", level: 1 },
    });
    const warnings: string[] = [];
    expect(unarmoredAC(resolved, mods, warnings)).toBe(15);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("initiativeBonus", () => {
  it("no feats → DEX mod", () => {
    expect(initiativeBonus(3, [], "2014")).toBe(3);
  });
  it("Alert in 2014 → DEX mod + 5", () => {
    const alert = { slug: "alert" } as never;
    expect(initiativeBonus(3, [alert], "2014")).toBe(8);
  });
  it("Alert in 2024 → no numeric bonus", () => {
    const alert = { slug: "alert" } as never;
    expect(initiativeBonus(3, [alert], "2024")).toBe(3);
  });
  it("feat with initiative_bonus flag stacks", () => {
    const custom = { slug: "quick", initiative_bonus: 2 } as never;
    expect(initiativeBonus(3, [custom], "2014")).toBe(5);
  });
});

describe("speedFromRace", () => {
  it("defaults to 30 when no race", () => {
    expect(speedFromRace(emptyResolved())).toBe(30);
  });
  it("uses race.speed.walk", () => {
    const resolved = emptyResolved();
    (resolved as { race: unknown }).race = { slug: "hill-folk", speed: { walk: 25 } };
    expect(speedFromRace(resolved)).toBe(25);
  });
  it("adds feat speed_bonus", () => {
    const resolved = emptyResolved();
    (resolved as { race: unknown }).race = { slug: "hill-folk", speed: { walk: 25 } };
    resolved.feats.push({ slug: "swift", speed_bonus: 10 } as never);
    expect(speedFromRace(resolved)).toBe(35);
  });
});

describe("computeAbilityScores", () => {
  it("base + racial ASI sums", () => {
    const r = emptyResolved();
    r.definition.abilities = { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 8 };
    (r as { race: unknown }).race = { slug: "hill-folk", ability_bonuses: { con: 2, wis: 1 } };
    const out = computeAbilityScores(r, {});
    expect(out.con).toBe(14);
    expect(out.wis).toBe(13);
    expect(out.dex).toBe(14);
  });
  it("overrides win over racial ASI", () => {
    const r = emptyResolved();
    r.definition.abilities = { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 8 };
    (r as { race: unknown }).race = { slug: "hill-folk", ability_bonuses: { con: 2 } };
    const out = computeAbilityScores(r, { scores: { con: 20 } });
    expect(out.con).toBe(20);
  });
  it("missing abilities default to 10", () => {
    const r = emptyResolved();
    r.definition.abilities = { str: 14 } as never;
    const out = computeAbilityScores(r, {});
    expect(out.dex).toBe(10);
    expect(out.str).toBe(14);
  });
});

describe("recalc (end-to-end)", () => {
  it("produces correct proficiency bonus at level 5", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    expect(recalc(r).proficiencyBonus).toBe(3);
  });

  it("computes saves: first class's save proficiencies only", () => {
    const rogue = mkClass("rogue", "d8", 5);
    (rogue.entity as unknown as { saving_throws: string[] }).saving_throws = ["dex", "int"];
    const r = withClass(rogue);
    r.definition.abilities = { str: 8, dex: 18, con: 14, int: 12, wis: 14, cha: 13 };
    const d = recalc(r);
    expect(d.saves.dex.proficient).toBe(true);
    expect(d.saves.int.proficient).toBe(true);
    expect(d.saves.str.proficient).toBe(false);
    expect(d.saves.dex.bonus).toBe(4 + 3); // DEX mod +4, prof +3
  });

  it("computes expertise skill bonus correctly", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    r.definition.abilities = { str: 8, dex: 18, con: 14, int: 12, wis: 14, cha: 13 };
    r.definition.skills.proficient = ["stealth"];
    r.definition.skills.expertise = ["stealth"];
    const d = recalc(r);
    expect(d.skills.stealth.proficiency).toBe("expertise");
    expect(d.skills.stealth.bonus).toBe(4 + 3 * 2);
  });

  it("computes all three passives", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    r.definition.abilities = { str: 8, dex: 18, con: 14, int: 12, wis: 14, cha: 13 };
    r.definition.skills.proficient = ["perception", "investigation"];
    const d = recalc(r);
    expect(d.passives.perception).toBe(10 + 2 + 3);
    expect(d.passives.investigation).toBe(10 + 1 + 3);
    expect(d.passives.insight).toBe(10 + 2);
  });

  it("HP max reflects multiclass PHB formula", () => {
    const rogue = mkClass("rogue", "d8", 5);
    const fighter = mkClass("fighter", "d10", 3);
    const r = withClasses([rogue, fighter]);
    r.definition.abilities = { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };
    // CON mod +2; 10 + 7*4 + 8*3 = 62
    expect(recalc(r).hp.max).toBe(62);
  });

  it("honours hp.max override", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    r.definition.overrides = { hp: { max: 100 } };
    expect(recalc(r).hp.max).toBe(100);
  });

  it("produces spellcasting struct for casting class", () => {
    const wiz = mkClass("wizard", "d6", 5);
    (wiz.entity as unknown as { spellcasting: unknown }).spellcasting = { ability: "int", preparation: "prepared", spell_list: "wizard" };
    const r = withClass(wiz);
    r.definition.abilities = { str: 8, dex: 12, con: 12, int: 18, wis: 12, cha: 10 };
    const d = recalc(r);
    expect(d.spellcasting).not.toBeNull();
    expect(d.spellcasting?.ability).toBe("int");
    // Prof 3 + INT +4 + 8 = 15 DC, +7 attack
    expect(d.spellcasting?.saveDC).toBe(15);
    expect(d.spellcasting?.attackBonus).toBe(7);
  });

  it("non-casting class → spellcasting null", () => {
    const r = withClass(mkClass("fighter", "d10", 5));
    expect(recalc(r).spellcasting).toBeNull();
  });

  it("override for ability score propagates to mod and saves", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    r.definition.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    r.definition.overrides = { scores: { str: 20 } };
    const d = recalc(r);
    expect(d.scores.str).toBe(20);
    expect(d.mods.str).toBe(5);
  });

  it("warns when race is missing", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    expect(recalc(r).warnings.some((w) => w.toLowerCase().includes("speed"))).toBe(true);
  });

  it("totalLevel never produces NaN", () => {
    const r = withClasses([]);
    expect(Number.isNaN(recalc(r).totalLevel)).toBe(false);
  });

  it("multi-word skills use kebab-case keys (animal-handling)", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    r.definition.abilities = { str: 10, dex: 12, con: 10, int: 10, wis: 14, cha: 10 };
    r.definition.skills.proficient = ["animal-handling"];
    const d = recalc(r);
    expect(d.skills["animal-handling"]).toBeDefined();
    expect(d.skills["animal-handling"].proficiency).toBe("proficient");
    // WIS +2, prof +3 at level 5 → +5
    expect(d.skills["animal-handling"].bonus).toBe(5);
  });

  it("sleight-of-hand uses kebab-case key", () => {
    const r = withClass(mkClass("rogue", "d8", 5));
    r.definition.abilities = { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 };
    r.definition.skills.expertise = ["sleight-of-hand"];
    r.definition.skills.proficient = ["sleight-of-hand"];
    const d = recalc(r);
    expect(d.skills["sleight-of-hand"].proficiency).toBe("expertise");
    // DEX +3, prof +3, expertise → +3 + 6 = 9
    expect(d.skills["sleight-of-hand"].bonus).toBe(9);
  });
});

// ─────── helpers ───────

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
    },
    race: null,
    classes: [],
    background: null,
    feats: [],
    totalLevel: 0,
    features: [],
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
  };
}

function withClass(c: ResolvedClass): ResolvedCharacter {
  const r = emptyResolved();
  r.classes = [c];
  return r;
}

function withClasses(cs: ResolvedClass[]): ResolvedCharacter {
  const r = emptyResolved();
  r.classes = cs;
  return r;
}
