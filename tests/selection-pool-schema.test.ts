import { describe, it, expect } from "vitest";
import {
  selectionPoolSchema,
  poolGrantSchema,
  tabDeclSchema,
} from "../src/shared/schemas/selection-pool-schema";

const pool = {
  id: "interdict-boons",
  label: "Interdict Boons",
  source: { entity_type: "optional-feature", where: { feature_type: "interdict-boon", available_to: "self" } },
  count: { column: "Interdict Boons" },
  replaceable: true,
};

describe("selectionPoolSchema", () => {
  it("accepts a well-formed pool", () => {
    expect(selectionPoolSchema.safeParse(pool).success).toBe(true);
  });
  it("rejects a non-self available_to", () => {
    const bad = { ...pool, source: { ...pool.source, where: { feature_type: "x", available_to: "all" } } };
    expect(selectionPoolSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects an entity_type other than optional-feature", () => {
    const bad = { ...pool, source: { ...pool.source, entity_type: "feat" } };
    expect(selectionPoolSchema.safeParse(bad).success).toBe(false);
  });
  it("requires a count column", () => {
    const { count, ...bad } = pool;
    expect(selectionPoolSchema.safeParse(bad).success).toBe(false);
  });
});

describe("poolGrantSchema", () => {
  it("accepts grants with wikilink features", () => {
    const g = { pool: "interdict-boons", grants: [{ feature: "[[axiomatic-seals]]", at_level: 7 }] };
    expect(poolGrantSchema.safeParse(g).success).toBe(true);
  });
  it("rejects a bare-string feature (must be a wikilink)", () => {
    const g = { pool: "interdict-boons", grants: [{ feature: "axiomatic-seals", at_level: 7 }] };
    expect(poolGrantSchema.safeParse(g).success).toBe(false);
  });
});

describe("tabDeclSchema", () => {
  it("accepts a pool-rendering tab", () => {
    expect(tabDeclSchema.safeParse({ id: "boons", label: "Interdict Boons", renders: { pool: "interdict-boons" } }).success).toBe(true);
  });
});
