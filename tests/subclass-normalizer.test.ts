import { describe, it, expect } from "vitest";
import { normalizeSrdSubclass } from "../src/modules/subclass/subclass.normalizer";

const minimalArchetype = {
  name: "Thief",
  slug: "thief",
  desc:
    "You hone your skills in the larcenous arts.\n\n" +
    "##### Fast Hands\nStarting at 3rd level, you can use the bonus action.\n\n" +
    "##### Second-Story Work\nStarting at 3rd level, you gain a climbing speed.",
  document__slug: "wotc-srd",
};

describe("normalizeSrdSubclass", () => {
  it("normalizes a minimal SRD archetype", () => {
    const out = normalizeSrdSubclass(minimalArchetype, { parentClassName: "Rogue" });
    expect(out.frontmatter.slug).toBe("thief");
    expect(out.frontmatter.entity_type).toBe("subclass");
    expect(out.data.parent_class).toBe("[[rogue]]");
  });

  it("places archetype features at level inferred from prose", () => {
    const out = normalizeSrdSubclass(minimalArchetype, { parentClassName: "Rogue" });
    expect(out.data.features_by_level[3]).toBeDefined();
    expect(out.data.features_by_level[3].some((f) => f.name === "Fast Hands")).toBe(true);
  });

  it("defaults unattributed archetype features to level 3", () => {
    const input = { ...minimalArchetype, desc: "##### Untagged\nNo level anchor." };
    const out = normalizeSrdSubclass(input, { parentClassName: "Rogue" });
    expect(out.data.features_by_level[3]).toBeDefined();
  });
});
