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
      effects: [{ kind: "ac-bonus", value: 1, conditions: ["wearing_armor"] }],
    };
    expect(optionalFeatureEntitySchema.safeParse(fighting).success).toBe(true);
  });

  it("rejects unknown feature_type values", () => {
    const bad = { ...minimalInvocation, feature_type: "supernatural-quirk" };
    expect(optionalFeatureEntitySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects available_to with non-wikilinks", () => {
    const bad = { ...minimalInvocation, available_to: ["warlock"] };
    expect(optionalFeatureEntitySchema.safeParse(bad).success).toBe(false);
  });
});
