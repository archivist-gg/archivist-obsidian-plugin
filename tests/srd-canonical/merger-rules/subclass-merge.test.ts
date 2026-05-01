import { describe, it, expect } from "vitest";
import { toSubclassCanonical } from "../../../tools/srd-canonical/merger-rules/subclass-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

// Mirrors the actual Open5e v2 classes-endpoint shape: subclass_of is an
// OBJECT { name, key }, and features carry feature_type + gained_at[].
const baseChampion = {
  key: "srd_champion",
  name: "Champion",
  desc: "The archetypal Champion focuses on raw physical power…",
  document: { key: "srd-2014", name: "SRD 5.1" },
  subclass_of: { name: "Fighter", key: "srd_fighter" },
  features: [
    {
      key: "srd_champion_improved-critical",
      name: "Improved Critical",
      desc: "Beginning when you choose this archetype, your weapon attacks score a critical hit on a roll of 19 or 20.",
      feature_type: "CLASS_LEVEL_FEATURE",
      gained_at: [{ level: 3, detail: null }],
      data_for_class_table: [],
    },
    {
      key: "srd_champion_remarkable-athlete",
      name: "Remarkable Athlete",
      desc: "Starting at 7th level, you can add half your proficiency bonus…",
      feature_type: "CLASS_LEVEL_FEATURE",
      gained_at: [{ level: 7, detail: null }],
      data_for_class_table: [],
    },
    // Noise that must be filtered out (non CLASS_LEVEL_FEATURE).
    {
      key: "srd_champion_table-noise",
      name: "Table Noise",
      desc: "junk",
      feature_type: "CLASS_TABLE_DATA",
      gained_at: [],
      data_for_class_table: [{ level: 1, column_value: "x" }],
    },
  ],
};

describe("subclassMergeRule", () => {
  it("emits parent_class wikilink from subclass_of object (2014)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_champion",
      edition: "2014",
      kind: "subclass",
      base: baseChampion,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSubclassCanonical(canonical);
    expect(out.slug).toBe("srd-5e_champion");
    expect(out.name).toBe("Champion");
    expect(out.parent_class).toBe("[[SRD 5e/Classes/Fighter]]");
  });

  it("emits parent_class wikilink under SRD 2024 compendium", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-2024_champion",
      edition: "2024",
      kind: "subclass",
      base: { ...baseChampion, subclass_of: { name: "Fighter", key: "srd-2024_fighter" } },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSubclassCanonical(canonical);
    expect(out.parent_class).toBe("[[SRD 2024/Classes/Fighter]]");
  });

  it("falls back to deriving parent name from string subclass_of", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_thief",
      edition: "2014",
      kind: "subclass",
      base: { ...baseChampion, name: "Thief", subclass_of: "srd_rogue" },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSubclassCanonical(canonical);
    expect(out.parent_class).toBe("[[SRD 5e/Classes/Rogue]]");
  });

  it("buckets features by gained_at level and filters CLASS_LEVEL_FEATURE only", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_champion",
      edition: "2014",
      kind: "subclass",
      base: baseChampion,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSubclassCanonical(canonical);
    expect(Object.keys(out.features_by_level).sort()).toEqual(["3", "7"]);
    expect(out.features_by_level["3"]).toHaveLength(1);
    expect(out.features_by_level["3"][0].name).toBe("Improved Critical");
    expect(out.features_by_level["7"][0].name).toBe("Remarkable Athlete");
  });

  it("merges overlay action_cost onto matching subclass feature by slug", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_champion",
      edition: "2014",
      kind: "subclass",
      base: baseChampion,
      structured: null,
      activation: null,
      overlay: {
        "remarkable-athlete": {
          action: "free",
        },
      },
    };
    const out = toSubclassCanonical(canonical);
    const ra = out.features_by_level["7"]?.[0];
    expect(ra?.action).toBe("free");
  });

  it("emits empty resources array (Open5e exposes none on subclasses)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_champion",
      edition: "2014",
      kind: "subclass",
      base: baseChampion,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSubclassCanonical(canonical);
    expect(out.resources).toEqual([]);
  });
});
