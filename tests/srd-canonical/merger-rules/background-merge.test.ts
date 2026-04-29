import { describe, it, expect } from "vitest";
import { toBackgroundCanonical } from "../../../tools/srd-canonical/merger-rules/background-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("backgroundMergeRule", () => {
  it("produces canonical Background from Open5e-only entry (Acolyte, 2014)", () => {
    const canonical: CanonicalEntry = {
      slug: "acolyte",
      edition: "2014",
      kind: "background",
      base: {
        key: "acolyte",
        name: "Acolyte",
        desc: "You have spent your life in the service of a temple…",
        document: { key: "srd-2014", name: "SRD 5.1" },
        skill_proficiencies: "Insight, Religion",
        tool_proficiencies: "",
        language_proficiencies: "Two of your choice",
        equipment: "A holy symbol, a prayer book, 5 sticks of incense, vestments, a set of common clothes, and a belt pouch containing 15 gp",
        feature: "Shelter of the Faithful",
        feature_desc: "As an acolyte, you command the respect of those who share your faith…",
        suggested_characteristics: "...",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.slug).toBe("acolyte");
    expect(out.edition).toBe("2014");
    expect(out.skill_proficiencies).toEqual(["Insight", "Religion"]);
    expect(out.tool_proficiencies).toEqual([]);
    expect(out.languages).toEqual(["Two of your choice"]);
    expect(out.equipment.length).toBeGreaterThan(3);
    expect(out.feature.name).toBe("Shelter of the Faithful");
    expect(out.feature.desc).toContain("acolyte");
    expect(out.origin_feat).toBeUndefined();
    expect(out.ability_score_increases).toBeUndefined();
  });

  it("populates origin_feat and ability_score_increases from structured-rules (2024)", () => {
    const canonical: CanonicalEntry = {
      slug: "acolyte",
      edition: "2024",
      kind: "background",
      base: {
        key: "acolyte",
        name: "Acolyte",
        desc: "You devoted yourself to service in a temple…",
        document: { key: "srd-2024", name: "SRD 5.2" },
        skill_proficiencies: "Insight, Medicine, Religion",
        tool_proficiencies: "",
        language_proficiencies: "",
        equipment: "Calligrapher's Supplies, Book (Prayers), Holy Symbol, Parchment (10 sheets), Robes, 8 GP",
        feature: "",
        feature_desc: "",
      },
      structured: {
        name: "Acolyte",
        source: "XPHB",
        feats: [{ name: "magic-initiate-cleric" }],
        abilityScoreImprovement: { count: 3 },
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.origin_feat).toBe("[[SRD 2024/Feats/Magic Initiate Cleric]]");
    expect(out.ability_score_increases).toEqual({ count: 3, applies_to: "any" });
  });
});
