import { describe, it, expect } from "vitest";
import { featEntitySchema } from "@archivist-gg/dnd5e/feat/feat.schema";

const minimalFeat = {
  slug: "alert",
  name: "Alert",
  edition: "2014",
  source: "SRD 5.1",
  category: "general",
  description: "Always on the lookout.",
  prerequisites: [],
  benefits: ["You can't be surprised while you are conscious."],
  effects: [{ kind: "initiative-bonus", value: 5 }],
  grants_asi: null,
  repeatable: false,
  choices: [],
};

describe("featEntitySchema", () => {
  it("accepts a minimal valid feat", () => {
    expect(featEntitySchema.safeParse(minimalFeat).success).toBe(true);
  });

  it("accepts 2024 feat with grants_asi", () => {
    const input = {
      ...minimalFeat,
      edition: "2024",
      grants_asi: { amount: 1, pool: ["dex", "int", "wis"] },
    };
    expect(featEntitySchema.safeParse(input).success).toBe(true);
  });

  it("accepts prerequisites discriminated union", () => {
    const input = {
      ...minimalFeat,
      prerequisites: [{ kind: "ability", ability: "str", min: 13 }, { kind: "level", min: 4 }],
    };
    expect(featEntitySchema.safeParse(input).success).toBe(true);
  });

  it("accepts the campaign and exclusive-feat-category converter arms (R4-G1a D4)", () => {
    const input = {
      ...minimalFeat,
      prerequisites: [{ kind: "campaign", slug: "eberron" }, { kind: "exclusive-feat-category", slug: "D" }],
    };
    const parsed = featEntitySchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.prerequisites).toEqual([
      { kind: "campaign", slug: "eberron" },
      { kind: "exclusive-feat-category", slug: "D" },
    ]);
  });

  it("rejects unknown category", () => {
    expect(featEntitySchema.safeParse({ ...minimalFeat, category: "boon" }).success).toBe(false);
  });
});
