import { describe, it, expect } from "vitest";
import { subclassEntitySchema } from "../packages/obsidian/src/modules/subclass/subclass.schema";

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

describe("subclassEntitySchema — Phase 2 fields", () => {
  it("accepts pool_grants and tabs", () => {
    const s = {
      ...minimalSubclass,
      pool_grants: [{ pool: "interdict-boons", grants: [{ feature: "[[axiomatic-seals]]", at_level: 7 }] }],
      tabs: [{ id: "boons", label: "Boons", renders: { pool: "interdict-boons" } }],
    };
    const r = subclassEntitySchema.safeParse(s);
    expect(r.success && (r.data as { pool_grants?: unknown }).pool_grants !== undefined).toBe(true);
  });

  it("still accepts a subclass with no pool fields", () => {
    expect(subclassEntitySchema.safeParse(minimalSubclass).success).toBe(true);
  });
});
