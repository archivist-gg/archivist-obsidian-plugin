import { describe, it, expect } from "vitest";
import { normalizeOptionalFeature } from "../src/modules/optional-feature/optional-feature.normalizer";

describe("normalizeOptionalFeature", () => {
  it("normalizes an invocation from external structured input", () => {
    const input = {
      name: "Agonizing Blast",
      source: "PHB",
      featureType: ["I"], // invocation tag
      entries: ["When you cast eldritch blast, add your Charisma modifier to damage."],
      prerequisite: [{ spell: ["eldritch blast#c"] }],
      classSource: "PHB",
      className: "Warlock",
      edition: "2014" as const,
    };
    const result = normalizeOptionalFeature(input);
    expect(result.frontmatter.entity_type).toBe("optional-feature");
    expect(result.data.feature_type).toBe("invocation");
    expect(result.data.available_to).toContain("[[SRD 5e/warlock]]");
    expect(result.data.prerequisites[0].kind).toBe("spell-known");
  });

  it("normalizes a fighting style", () => {
    const input = {
      name: "Defense",
      source: "PHB",
      featureType: ["FS:F", "FS:P", "FS:R"],
      entries: ["While wearing armor, +1 AC."],
      edition: "2014" as const,
    };
    const result = normalizeOptionalFeature(input);
    expect(result.data.feature_type).toBe("fighting_style");
    expect(result.data.available_to).toEqual(
      expect.arrayContaining(["[[SRD 5e/fighter]]", "[[SRD 5e/paladin]]", "[[SRD 5e/ranger]]"])
    );
  });
});
