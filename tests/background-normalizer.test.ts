import { describe, it, expect } from "vitest";
import { normalizeSrdBackground } from "../src/modules/background/background.normalizer";

const minimalAcolyte = {
  name: "Acolyte",
  slug: "acolyte",
  desc: "You have spent your life in the service of a temple.",
  benefits: [
    { name: "Skill Proficiencies", desc: "Insight, Religion" },
    { name: "Languages", desc: "Two of your choice" },
    { name: "Equipment", desc: "A holy symbol, 15 gp" },
    { name: "Feature: Shelter of the Faithful", desc: "Priests provide shelter.", type: "feature" },
  ],
  document__slug: "wotc-srd",
};

describe("normalizeSrdBackground", () => {
  it("normalizes a minimal SRD acolyte", () => {
    const out = normalizeSrdBackground(minimalAcolyte);
    expect(out.frontmatter.slug).toBe("acolyte");
    expect(out.frontmatter.entity_type).toBe("background");
    expect(out.data.skill_proficiencies).toContain("insight");
    expect(out.data.skill_proficiencies).toContain("religion");
    expect(out.data.language_proficiencies[0]).toMatchObject({ kind: "choice", count: 2, from: "any" });
    expect(out.data.feature.name).toBe("Shelter of the Faithful");
    expect(out.data.equipment.some((e) => "kind" in e && e.kind === "currency")).toBe(true);
  });

  it("defaults ASI and origin_feat to null on 2014 data", () => {
    const out = normalizeSrdBackground(minimalAcolyte);
    expect(out.data.ability_score_increases).toBeNull();
    expect(out.data.origin_feat).toBeNull();
  });
});
