import { describe, it, expect } from "vitest";
import { parseBackground } from "../src/modules/background/background.parser";

const yaml = `
slug: acolyte
name: Acolyte
edition: "2014"
source: "SRD 5.1"
description: Devoted.
skill_proficiencies: [insight, religion]
tool_proficiencies: []
language_proficiencies:
  - { kind: choice, count: 2, from: any }
equipment:
  - { item: holy-symbol, quantity: 1 }
  - { kind: currency, gp: 15 }
feature: { name: "Shelter of the Faithful", description: "Rites." }
ability_score_increases: null
origin_feat: null
suggested_characteristics: null
variants: []
`;

describe("parseBackground", () => {
  it("parses a valid background", () => {
    const result = parseBackground(yaml);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe("acolyte");
  });

  it("rejects invalid feature (missing description)", () => {
    const bad = yaml.replace(`feature: { name: "Shelter of the Faithful", description: "Rites." }`, `feature: { name: "Feature only" }`);
    expect(parseBackground(bad).success).toBe(false);
  });
});
