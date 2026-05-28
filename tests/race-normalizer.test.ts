import { describe, it, expect } from "vitest";
import { normalizeSrdRace } from "../src/modules/race/race.normalizer";

const minimalOpen5eDwarf = {
  name: "Dwarf",
  slug: "dwarf",
  desc: "Bold and hardy.",
  asi: [{ attributes: ["Constitution"], value: 2 }],
  asi_desc: "Constitution +2.",
  age: "Dwarves mature at 50.",
  alignment: "Most are lawful good.",
  size: "Medium",
  speed: { walk: 25 },
  languages: "You can speak, read, and write Common and Dwarvish.",
  vision: "Darkvision. 60 feet.",
  traits: "_**Dwarven Resilience.**_ You have advantage on saving throws against poison.",
  document__slug: "wotc-srd",
};

describe("normalizeSrdRace", () => {
  it("normalizes a minimal SRD dwarf", () => {
    const out = normalizeSrdRace(minimalOpen5eDwarf);
    expect(out.frontmatter.slug).toBe("dwarf");
    expect(out.frontmatter.entity_type).toBe("race");
    expect(out.data.size).toBe("medium");
    expect(out.data.speed.walk).toBe(25);
    expect(out.data.vision.darkvision).toBe(60);
    expect(out.data.ability_score_increases).toEqual([{ ability: "con", amount: 2 }]);
    expect(out.data.languages.fixed).toContain("dwarvish");
    expect(out.data.traits[0]?.name).toBe("Dwarven Resilience");
  });

  it("omits ASI on 2024 species", () => {
    const out = normalizeSrdRace(minimalOpen5eDwarf, { edition: "2024" });
    expect(out.data.edition).toBe("2024");
    expect(out.data.ability_score_increases).toEqual([]);
  });

  it("defaults speed to walk:30 when not specified", () => {
    const input = { ...minimalOpen5eDwarf, speed: undefined };
    const out = normalizeSrdRace(input);
    expect(out.data.speed.walk).toBe(30);
  });
});
