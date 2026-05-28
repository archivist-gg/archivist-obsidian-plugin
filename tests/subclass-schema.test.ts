import { describe, it, expect } from "vitest";
import { subclassEntitySchema } from "../src/modules/subclass/subclass.schema";

const minimalSubclass = {
  slug: "thief",
  name: "Thief",
  parent_class: "[[rogue]]",
  edition: "2014",
  source: "SRD 5.1",
  description: "Burglar.",
  features_by_level: { "3": [{ name: "Fast Hands", description: "..." }] },
  resources: [],
};

describe("subclassEntitySchema", () => {
  it("accepts a minimal valid subclass", () => {
    expect(subclassEntitySchema.safeParse(minimalSubclass).success).toBe(true);
  });

  it("rejects non-wikilink parent_class", () => {
    expect(subclassEntitySchema.safeParse({ ...minimalSubclass, parent_class: "rogue" }).success).toBe(false);
  });

  it("rejects empty slug", () => {
    expect(subclassEntitySchema.safeParse({ ...minimalSubclass, slug: "" }).success).toBe(false);
  });
});
