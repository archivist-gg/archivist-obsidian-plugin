import { describe, it, expect } from "vitest";
import { backgroundEntitySchema } from "../src/modules/background/background.schema";

const minimalBackground = {
  slug: "acolyte",
  name: "Acolyte",
  edition: "2014",
  source: "SRD 5.1",
  description: "Devoted.",
  skill_proficiencies: ["insight", "religion"],
  tool_proficiencies: [],
  language_proficiencies: [{ kind: "choice", count: 2, from: "any" }],
  equipment: [{ item: "holy-symbol", quantity: 1 }, { kind: "currency", gp: 15 }],
  feature: { name: "Shelter of the Faithful", description: "Perform rites." },
  ability_score_increases: null,
  origin_feat: null,
  suggested_characteristics: null,
  variants: [],
};

describe("backgroundEntitySchema", () => {
  it("accepts a minimal valid background", () => {
    expect(backgroundEntitySchema.safeParse(minimalBackground).success).toBe(true);
  });

  it("accepts a 2024 background with ASI + origin feat", () => {
    const input = {
      ...minimalBackground,
      edition: "2024",
      ability_score_increases: { pool: ["int", "wis", "cha"] },
      origin_feat: "[[magic-initiate-cleric]]",
    };
    expect(backgroundEntitySchema.safeParse(input).success).toBe(true);
  });

  it("rejects origin_feat that is not a wikilink", () => {
    const input = { ...minimalBackground, edition: "2024", origin_feat: "magic-initiate" };
    expect(backgroundEntitySchema.safeParse(input).success).toBe(false);
  });

  it("rejects ASI pool with wrong length", () => {
    const input = { ...minimalBackground, edition: "2024", ability_score_increases: { pool: ["int", "wis"] } };
    expect(backgroundEntitySchema.safeParse(input).success).toBe(false);
  });
});
