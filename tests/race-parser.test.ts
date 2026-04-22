import { describe, it, expect } from "vitest";
import { parseRace } from "../src/modules/race/race.parser";

const yaml = `
slug: dwarf
name: Dwarf
edition: "2014"
source: "SRD 5.1"
description: Stout.
size: medium
speed: { walk: 25 }
ability_score_increases:
  - { ability: con, amount: 2 }
age: Dwarves mature at 50.
alignment: Most are lawful.
vision: { darkvision: 60 }
languages:
  fixed: [common, dwarvish]
variant_label: Subrace
variants: []
traits:
  - name: Dwarven Resilience
    description: "Advantage on poison saves."
`;

describe("parseRace", () => {
  it("parses a valid race", () => {
    const result = parseRace(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("dwarf");
      expect(result.data.vision.darkvision).toBe(60);
    }
  });

  it("rejects missing required fields", () => {
    expect(parseRace(`slug: dwarf`).success).toBe(false);
  });
});
