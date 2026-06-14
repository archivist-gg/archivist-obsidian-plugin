import { describe, it, expect } from "vitest";
import { resolvePool, type PoolRegistry } from "../src/modules/pc/pc.pools";
import type { ResolvedClass } from "../src/modules/pc/pc.types";

function of(slug: string, ft: string, levelMin?: number) {
  return {
    slug, name: slug, type: "optional-feature",
    data: {
      slug, name: slug, edition: "2014", source: "hb",
      feature_type: ft, description: "", effects: [],
      available_to: ["[[reaver]]"],
      prerequisites: levelMin ? [{ kind: "level", min: levelMin }] : [],
    },
  };
}

function mkRegistry(entities: ReturnType<typeof of>[]): PoolRegistry {
  return {
    search: (_q, type) => (type === "optional-feature" ? entities : []) as never,
    getByTypeAndSlug: (type, slug) =>
      (type === "optional-feature" ? entities.find((e) => e.slug === slug) : undefined) as never,
  };
}

const boons = [
  of("baleful-glare", "interdict-boon"),
  of("hell-mage", "interdict-boon", 7),
  of("not-a-boon", "metamagic"),
];

function mkClass(level: number, choices: Record<number, Record<string, unknown>> = {}): ResolvedClass {
  return {
    entity: {
      slug: "reaver", name: "Reaver",
      table: { 2: { columns: { "Interdict Boons": 1 }, prof_bonus: 2, feature_ids: [] },
               7: { columns: { "Interdict Boons": 3 }, prof_bonus: 3, feature_ids: [] } },
    } as never,
    level,
    subclass: null,
    choices: choices as never,
  };
}

const pool = {
  id: "interdict-boons", label: "Interdict Boons",
  source: { entity_type: "optional-feature" as const, where: { feature_type: "interdict-boon", available_to: "self" as const } },
  count: { column: "Interdict Boons" },
};

describe("resolvePool", () => {
  it("reads count from the class table column at the current level", () => {
    const r = resolvePool(mkClass(7), 0, pool, mkRegistry(boons));
    expect(r.count).toBe(3);
  });
  it("anchors at the lowest level where count >= 1", () => {
    const r = resolvePool(mkClass(7), 0, pool, mkRegistry(boons));
    expect(r.anchorLevel).toBe(2);
  });
  it("filters candidates by feature_type and available_to", () => {
    const r = resolvePool(mkClass(7), 0, pool, mkRegistry(boons));
    expect(r.available.map((e) => e.slug).sort()).toEqual(["baleful-glare", "hell-mage"]);
  });
  it("excludes candidates whose level prereq exceeds the current level", () => {
    const r = resolvePool(mkClass(2), 0, pool, mkRegistry(boons));
    expect(r.available.map((e) => e.slug)).toEqual(["baleful-glare"]); // hell-mage (min 7) hidden at L2
  });
  it("resolves player picks from the choices ledger at the anchor level", () => {
    const r = resolvePool(mkClass(7, { 2: { "interdict-boons": ["baleful-glare"] } }), 0, pool, mkRegistry(boons));
    expect(r.selected.map((e) => e.slug)).toEqual(["baleful-glare"]);
  });
  it("includes subclass pool_grants at/under level and they do not count", () => {
    const rc = mkClass(20);
    rc.subclass = { slug: "asmodeus", pool_grants: [
      { pool: "interdict-boons", grants: [{ feature: "[[hell-mage]]", at_level: 18 }, { feature: "[[baleful-glare]]", at_level: 99 }] },
    ] } as never;
    const r = resolvePool(rc, 0, pool, mkRegistry(boons));
    expect(r.grants.map((e) => e.slug)).toEqual(["hell-mage"]); // at_level 99 excluded
  });
});
