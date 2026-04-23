import { describe, it, expect } from "vitest";
import { characterSchema } from "../src/modules/pc/pc.schema";

const minimalValid = {
  name: "Grendal",
  edition: "2014",
  class: [{ name: "[[bladesworn]]", level: 3, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 13, cha: 8 },
  ability_method: "manual",
  state: {
    hp: { current: 24, max: 24, temp: 0 },
  },
};

function validMinimalCharacter() {
  return JSON.parse(JSON.stringify(minimalValid));
}

describe("characterSchema", () => {
  it("accepts a minimal valid character", () => {
    const r = characterSchema.safeParse(minimalValid);
    expect(r.success).toBe(true);
  });

  it("rejects a character with no classes", () => {
    const r = characterSchema.safeParse({ ...minimalValid, class: [] });
    expect(r.success).toBe(false);
  });

  it("rejects class level above 20", () => {
    const bad = { ...minimalValid, class: [{ name: "[[x]]", level: 21, subclass: null, choices: {} }] };
    expect(characterSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown ability_method", () => {
    const bad = { ...minimalValid, ability_method: "custom" };
    expect(characterSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts 2024 edition", () => {
    const r = characterSchema.safeParse({ ...minimalValid, edition: "2024" });
    expect(r.success).toBe(true);
  });

  it("defaults optional containers (skills, spells, equipment, overrides)", () => {
    const r = characterSchema.parse(minimalValid);
    expect(r.skills).toEqual({ proficient: [], expertise: [] });
    expect(r.spells).toEqual({ known: [], overrides: [] });
    expect(r.equipment).toEqual([]);
    expect(r.overrides).toEqual({});
  });

  it("rejects unknown skill slug", () => {
    const bad = { ...minimalValid, skills: { proficient: ["flying"], expertise: [] } };
    expect(characterSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts ability overrides", () => {
    const r = characterSchema.safeParse({
      ...minimalValid,
      overrides: { scores: { str: 20 }, ac: 16 },
    });
    expect(r.success).toBe(true);
  });
});

describe("V7 schema additions", () => {
  it("accepts a defenses block with all four categories", () => {
    const base = validMinimalCharacter();
    const parsed = characterSchema.parse({
      ...base,
      defenses: {
        resistances: ["fire"],
        immunities: ["poison"],
        vulnerabilities: ["radiant"],
        condition_immunities: ["charmed"],
      },
    });
    expect(parsed.defenses?.resistances).toEqual(["fire"]);
    expect(parsed.defenses?.condition_immunities).toEqual(["charmed"]);
  });

  it("defenses is fully optional and every subfield is optional", () => {
    const base = validMinimalCharacter();
    expect(characterSchema.safeParse(base).success).toBe(true);
    expect(characterSchema.safeParse({ ...base, defenses: {} }).success).toBe(true);
  });

  it("inspiration is a non-negative integer with default 0", () => {
    const base = validMinimalCharacter();
    const parsed = characterSchema.parse(base);
    expect(parsed.state.inspiration).toBe(0);

    const explicit = characterSchema.parse({ ...base, state: { ...base.state, inspiration: 3 } });
    expect(explicit.state.inspiration).toBe(3);

    const bad = characterSchema.safeParse({ ...base, state: { ...base.state, inspiration: -1 } });
    expect(bad.success).toBe(false);
  });
});
