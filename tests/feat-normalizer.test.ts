import { describe, it, expect } from "vitest";
import { normalizeSrdFeat } from "../src/modules/feat/feat.normalizer";

const minimalGrappler = {
  name: "Grappler",
  slug: "grappler",
  desc: "You've developed techniques for grappling.\n* You have advantage on attack rolls.\n* You can use your action to pin a creature.",
  prerequisite: "Strength 13",
  document__slug: "wotc-srd",
};

describe("normalizeSrdFeat", () => {
  it("normalizes a minimal SRD feat", () => {
    const out = normalizeSrdFeat(minimalGrappler);
    expect(out.frontmatter.slug).toBe("grappler");
    expect(out.frontmatter.entity_type).toBe("feat");
    expect(out.data.category).toBe("general");
    expect(out.data.prerequisites).toEqual([{ kind: "ability", ability: "str", min: 13 }]);
    expect(out.data.benefits.length).toBeGreaterThan(0);
  });

  it("defaults grants_asi to null", () => {
    const out = normalizeSrdFeat(minimalGrappler);
    expect(out.data.grants_asi).toBeNull();
  });
});
