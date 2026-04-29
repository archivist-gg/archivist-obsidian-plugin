import { describe, it, expect } from "vitest";
import { raceEntitySchema } from "../src/modules/race/race.schema";

const minimalRace = {
  slug: "dwarf",
  name: "Dwarf",
  edition: "2014",
  source: "SRD 5.1",
  description: "Stout.",
  size: "medium",
  speed: { walk: 25 },
  ability_score_increases: [{ ability: "con", amount: 2 }],
  age: "Dwarves mature at 50.",
  alignment: "Most dwarves are lawful.",
  vision: { darkvision: 60 },
  languages: { fixed: ["common", "dwarvish"] },
  variant_label: "Subrace",
  variants: [],
  traits: [{ name: "Dwarven Resilience", description: "Advantage on poison saves." }],
};

describe("raceEntitySchema", () => {
  it("accepts a minimal valid race", () => {
    expect(raceEntitySchema.safeParse(minimalRace).success).toBe(true);
  });

  it("accepts a 2024 species with empty ASI", () => {
    expect(raceEntitySchema.safeParse({ ...minimalRace, edition: "2024", ability_score_increases: [] }).success).toBe(true);
  });

  it("accepts a choice-style ASI", () => {
    const input = {
      ...minimalRace,
      ability_score_increases: [{ choose: 2, pool: ["str", "dex", "con"], amount: 1 }],
    };
    expect(raceEntitySchema.safeParse(input).success).toBe(true);
  });

  it("accepts race with variants", () => {
    const input = {
      ...minimalRace,
      variants: [{ slug: "hill-dwarf", name: "Hill Dwarf", description: "..." }],
    };
    expect(raceEntitySchema.safeParse(input).success).toBe(true);
  });

  it("rejects invalid size", () => {
    expect(raceEntitySchema.safeParse({ ...minimalRace, size: "gargantuan" }).success).toBe(false);
  });
});

describe("subspecies_of", () => {
  it("accepts absent subspecies_of (parent races)", () => {
    const parent = { ...minimalRace, subspecies_of: undefined };
    expect(raceEntitySchema.safeParse(parent).success).toBe(true);
  });

  it("accepts wikilink-shaped subspecies_of (subspecies)", () => {
    const child = { ...minimalRace, slug: "hill-dwarf", name: "Hill Dwarf", subspecies_of: "[[SRD 5e/dwarf]]" };
    expect(raceEntitySchema.safeParse(child).success).toBe(true);
  });

  it("rejects non-wikilink subspecies_of", () => {
    const bad = { ...minimalRace, subspecies_of: "dwarf" };
    expect(raceEntitySchema.safeParse(bad).success).toBe(false);
  });
});
