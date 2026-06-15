import { describe, it, expect } from "vitest";
import { optionalFeatureEntitySchema } from "../src/modules/optional-feature/optional-feature.schema";

const minimalInvocation = {
  slug: "agonizing-blast",
  name: "Agonizing Blast",
  edition: "2014",
  source: "SRD 5.1",
  feature_type: "invocation",
  description: "When you cast eldritch blast, add your Charisma modifier to the damage…",
  prerequisites: [{ kind: "spell-known", spell: "[[SRD 5e/eldritch-blast]]" }],
  available_to: ["[[SRD 5e/warlock]]"],
  effects: [],
};

describe("optionalFeatureEntitySchema", () => {
  it("accepts a minimal invocation", () => {
    expect(optionalFeatureEntitySchema.safeParse(minimalInvocation).success).toBe(true);
  });

  it("accepts a fighting style with multi-class availability", () => {
    const fighting = {
      slug: "defense",
      name: "Defense",
      edition: "2014",
      source: "SRD 5.1",
      feature_type: "fighting_style",
      description: "While wearing armor, +1 AC.",
      prerequisites: [],
      available_to: ["[[SRD 5e/fighter]]", "[[SRD 5e/paladin]]", "[[SRD 5e/ranger]]"],
      effects: [],
    };
    expect(optionalFeatureEntitySchema.safeParse(fighting).success).toBe(true);
  });

  it("accepts a homebrew feature_type string (enum is now open)", () => {
    const boon = { ...minimalInvocation, feature_type: "interdict-boon" };
    expect(optionalFeatureEntitySchema.safeParse(boon).success).toBe(true);
  });

  it("rejects an empty feature_type", () => {
    const bad = { ...minimalInvocation, feature_type: "" };
    expect(optionalFeatureEntitySchema.safeParse(bad).success).toBe(false);
  });

  it("accepts consumes / duration / passive", () => {
    const boon = {
      ...minimalInvocation,
      feature_type: "interdict-boon",
      consumes: { resource: "seals", amount: 1 },
      duration: { amount: 1, unit: "minute" },
      passive: true,
    };
    expect(optionalFeatureEntitySchema.safeParse(boon).success).toBe(true);
  });

  it("accepts an activatable boon with a structured duration and preserves the flag", () => {
    const boon = {
      ...minimalInvocation,
      feature_type: "interdict-boon",
      activatable: true,
      duration: { amount: 10, unit: "minute" },
      effects: [{ kind: "ac-bonus", value: 2 }],
    };
    const parsed = optionalFeatureEntitySchema.safeParse(boon);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ activatable: true, duration: { amount: 10, unit: "minute" } });
  });

  it("rejects available_to with non-wikilinks", () => {
    const bad = { ...minimalInvocation, available_to: ["warlock"] };
    expect(optionalFeatureEntitySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects level prerequisite missing min", () => {
    const bad = { ...minimalInvocation, prerequisites: [{ kind: "level" }] };
    expect(optionalFeatureEntitySchema.safeParse(bad).success).toBe(false);
  });
});
