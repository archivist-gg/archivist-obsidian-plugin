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

  it("normalizes a level prerequisite", () => {
    const input = {
      name: "Voice of the Chain Master",
      source: "PHB",
      featureType: ["I"],
      entries: ["Your familiar can speak."],
      prerequisite: [{ level: 5 }],
      edition: "2014" as const,
    };
    const result = normalizeOptionalFeature(input);
    expect(result.data.prerequisites).toEqual([{ kind: "level", min: 5 }]);
  });

  it("normalizes a pact prerequisite (filtered to known pacts)", () => {
    const input = {
      name: "Book of Ancient Secrets",
      source: "PHB",
      featureType: ["I"],
      entries: ["You can scribe rituals."],
      prerequisite: [{ pact: ["tome", "unknown-pact"] }],
      edition: "2014" as const,
    };
    const result = normalizeOptionalFeature(input);
    expect(result.data.prerequisites).toEqual([{ kind: "pact", pact: "tome" }]);
  });

  it("targets SRD 2024 compendium when edition is 2024", () => {
    const input = {
      name: "Agonizing Blast",
      source: "XPHB",
      featureType: ["I"],
      entries: ["When you cast eldritch blast..."],
      prerequisite: [{ spell: ["eldritch blast#c"] }],
      edition: "2024" as const,
    };
    const result = normalizeOptionalFeature(input);
    expect(result.frontmatter.compendium).toBe("SRD 2024");
    expect(result.data.available_to).toEqual(["[[SRD 2024/warlock]]"]);
    expect(result.data.prerequisites[0]).toEqual({
      kind: "spell-known",
      spell: "[[SRD 2024/eldritch-blast]]",
    });
  });

  it("maps FS:B to ranger (fighting style: ranger conclave)", () => {
    const input = {
      name: "Two-Weapon Fighting",
      source: "PHB",
      featureType: ["FS:B"],
      entries: ["When you engage in two-weapon fighting..."],
      edition: "2014" as const,
    };
    const result = normalizeOptionalFeature(input);
    expect(result.data.feature_type).toBe("fighting_style");
    expect(result.data.available_to).toEqual(["[[SRD 5e/ranger]]"]);
  });
});
