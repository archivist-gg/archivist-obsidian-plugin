// tests/dnd-constants.test.ts
import { describe, it, expect } from "vitest";
import {
  CR_PROFICIENCY, CR_XP, SIZE_HIT_DICE, SKILL_ABILITY,
  ALL_CR_VALUES, DAMAGE_TYPES, ABILITY_KEYS,
  DAMAGE_NONMAGICAL_VARIANTS, CONDITIONS,
} from "../src/dnd/constants";

describe("CR_PROFICIENCY", () => {
  it("CR 0 through 4 have proficiency +2", () => {
    for (const cr of ["0", "1/8", "1/4", "1/2", "1", "2", "3", "4"]) {
      expect(CR_PROFICIENCY[cr]).toBe(2);
    }
  });
  it("CR 5 through 8 have proficiency +3", () => {
    for (const cr of ["5", "6", "7", "8"]) { expect(CR_PROFICIENCY[cr]).toBe(3); }
  });
  it("CR 9 through 12 have proficiency +4", () => {
    for (const cr of ["9", "10", "11", "12"]) { expect(CR_PROFICIENCY[cr]).toBe(4); }
  });
  it("CR 29-30 have proficiency +9", () => {
    expect(CR_PROFICIENCY["29"]).toBe(9);
    expect(CR_PROFICIENCY["30"]).toBe(9);
  });
  it("covers all 34 CR values", () => { expect(Object.keys(CR_PROFICIENCY)).toHaveLength(34); });
});

describe("CR_XP", () => {
  it("CR 0 = 10 XP", () => expect(CR_XP["0"]).toBe(10));
  it("CR 1/4 = 50 XP", () => expect(CR_XP["1/4"]).toBe(50));
  it("CR 1 = 200 XP", () => expect(CR_XP["1"]).toBe(200));
  it("CR 20 = 25000 XP", () => expect(CR_XP["20"]).toBe(25000));
  it("CR 30 = 155000 XP", () => expect(CR_XP["30"]).toBe(155000));
  it("covers all 34 CR values", () => { expect(Object.keys(CR_XP)).toHaveLength(34); });
});

describe("SIZE_HIT_DICE", () => {
  it("tiny = d4", () => expect(SIZE_HIT_DICE["tiny"]).toBe(4));
  it("small = d6", () => expect(SIZE_HIT_DICE["small"]).toBe(6));
  it("medium = d8", () => expect(SIZE_HIT_DICE["medium"]).toBe(8));
  it("large = d10", () => expect(SIZE_HIT_DICE["large"]).toBe(10));
  it("huge = d12", () => expect(SIZE_HIT_DICE["huge"]).toBe(12));
  it("gargantuan = d20", () => expect(SIZE_HIT_DICE["gargantuan"]).toBe(20));
});

describe("SKILL_ABILITY", () => {
  it("maps all 18 skills", () => { expect(Object.keys(SKILL_ABILITY)).toHaveLength(18); });
  it("acrobatics uses dex", () => expect(SKILL_ABILITY["acrobatics"]).toBe("dex"));
  it("athletics uses str", () => expect(SKILL_ABILITY["athletics"]).toBe("str"));
  it("perception uses wis", () => expect(SKILL_ABILITY["perception"]).toBe("wis"));
  it("stealth uses dex", () => expect(SKILL_ABILITY["stealth"]).toBe("dex"));
  it("animal handling uses wis", () => expect(SKILL_ABILITY["animal handling"]).toBe("wis"));
  it("sleight of hand uses dex", () => expect(SKILL_ABILITY["sleight of hand"]).toBe("dex"));
  it("arcana uses int", () => expect(SKILL_ABILITY["arcana"]).toBe("int"));
  it("deception uses cha", () => expect(SKILL_ABILITY["deception"]).toBe("cha"));
});

describe("ALL_CR_VALUES", () => {
  it("has 34 entries in display order", () => {
    expect(ALL_CR_VALUES).toHaveLength(34);
    expect(ALL_CR_VALUES[0]).toBe("0");
    expect(ALL_CR_VALUES[1]).toBe("1/8");
    expect(ALL_CR_VALUES[2]).toBe("1/4");
    expect(ALL_CR_VALUES[3]).toBe("1/2");
    expect(ALL_CR_VALUES[4]).toBe("1");
    expect(ALL_CR_VALUES[33]).toBe("30");
  });
});

describe("ABILITY_KEYS", () => {
  it("has 6 entries in standard order", () => {
    expect(ABILITY_KEYS).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });
});

describe("DAMAGE_TYPES", () => {
  it("has 13 standard damage types", () => {
    expect(DAMAGE_TYPES).toHaveLength(13);
  });
  it("includes all standard types", () => {
    expect(DAMAGE_TYPES).toContain("Fire");
    expect(DAMAGE_TYPES).toContain("Slashing");
    expect(DAMAGE_TYPES).toContain("Psychic");
  });
});

describe("DAMAGE_NONMAGICAL_VARIANTS", () => {
  it("has 3 nonmagical variants", () => {
    expect(DAMAGE_NONMAGICAL_VARIANTS).toHaveLength(3);
  });
  it("includes base nonmagical variant", () => {
    expect(DAMAGE_NONMAGICAL_VARIANTS[0]).toBe(
      "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks"
    );
  });
  it("includes silvered variant", () => {
    expect(DAMAGE_NONMAGICAL_VARIANTS[1]).toContain("Silvered");
  });
  it("includes adamantine variant", () => {
    expect(DAMAGE_NONMAGICAL_VARIANTS[2]).toContain("Adamantine");
  });
});

describe("CONDITIONS", () => {
  it("has 15 standard conditions", () => {
    expect(CONDITIONS).toHaveLength(15);
  });
  it("includes key conditions", () => {
    expect(CONDITIONS).toContain("Blinded");
    expect(CONDITIONS).toContain("Frightened");
    expect(CONDITIONS).toContain("Unconscious");
  });
  it("is alphabetically sorted", () => {
    const sorted = [...CONDITIONS].sort();
    expect(CONDITIONS).toEqual(sorted);
  });
});
