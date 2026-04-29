import { describe, it, expect } from "vitest";
import { toSubclassCanonical } from "../../../tools/srd-canonical/merger-rules/subclass-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseChampion = {
  key: "champion",
  name: "Champion",
  desc: "The archetypal Champion focuses on raw physical power…",
  document: { key: "srd-2014", name: "SRD 5.1" },
  subclass_of: "fighter",
  features: [
    { level: 3, name: "Improved Critical", desc: "Beginning when you choose this archetype, your weapon attacks score a critical hit on a roll of 19 or 20." },
    { level: 7, name: "Remarkable Athlete", desc: "Starting at 7th level, you can add half your proficiency bonus…" },
  ],
};

describe("subclassMergeRule", () => {
  it("produces canonical Subclass with parent_class wikilink (2014)", () => {
    const canonical: CanonicalEntry = {
      slug: "champion",
      edition: "2014",
      kind: "subclass",
      base: baseChampion,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSubclassCanonical(canonical);
    expect(out.slug).toBe("champion");
    expect(out.parent_class).toBe("[[SRD 5e/fighter]]");
    expect(out.features.length).toBe(2);
    expect(out.features[0].name).toBe("Improved Critical");
  });

  it("merges overlay class_features action economy onto matching subclass feature by slug", () => {
    const canonical: CanonicalEntry = {
      slug: "champion",
      edition: "2014",
      kind: "subclass",
      base: baseChampion,
      structured: null,
      activation: null,
      overlay: {
        "remarkable-athlete": {
          action_cost: "free",
        },
      },
    };
    const out = toSubclassCanonical(canonical);
    const ra = out.features.find(f => f.name === "Remarkable Athlete");
    expect(ra?.action_cost).toBe("free");
  });
});
