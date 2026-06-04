import { describe, it, expect } from "vitest";
import { castTimeCategory, rangeCategory } from "../src/modules/pc/components/spells/spell-filter";

describe("castTimeCategory", () => {
  it("maps the standard tokens", () => {
    expect(castTimeCategory("action")).toBe("action");
    expect(castTimeCategory("bonus-action")).toBe("bonus");
    expect(castTimeCategory("reaction")).toBe("reaction");
    expect(castTimeCategory("1minute")).toBe("long");
    expect(castTimeCategory("10minutes")).toBe("long");
    expect(castTimeCategory("1hour")).toBe("long");
    expect(castTimeCategory(undefined)).toBe("special");
    expect(castTimeCategory("weird")).toBe("special");
  });
});

describe("rangeCategory", () => {
  it("buckets the range string", () => {
    expect(rangeCategory("Self")).toBe("self");
    expect(rangeCategory("Self (15-foot cone)")).toBe("self");
    expect(rangeCategory("Touch")).toBe("touch");
    expect(rangeCategory("120 feet")).toBe("ranged");
    expect(rangeCategory("60 ft")).toBe("ranged");
    expect(rangeCategory("1 mile")).toBe("special");
    expect(rangeCategory("Sight")).toBe("special");
    expect(rangeCategory(undefined)).toBe("special");
  });
});

import { castTimeRank, rangeSortValue, compareCandidates } from "../src/modules/pc/components/spells/spell-filter";
import type { SpellCandidate } from "../src/modules/pc/components/spells/spell-access";

const cand = (over: Partial<SpellCandidate> & { entity?: object } = {}): SpellCandidate => ({
  slug: over.slug ?? "s", name: over.name ?? "Zed", level: over.level ?? 1,
  entity: (over.entity ?? {}) as never,
});

describe("castTimeRank", () => {
  it("orders action < bonus < reaction < long < special", () => {
    expect(castTimeRank("action")).toBeLessThan(castTimeRank("bonus-action"));
    expect(castTimeRank("reaction")).toBeLessThan(castTimeRank("1hour"));
    expect(castTimeRank("1hour")).toBeLessThan(castTimeRank(undefined));
  });
});

describe("rangeSortValue", () => {
  it("Self < Touch < feet ascending < special", () => {
    expect(rangeSortValue("Self")).toBe(0);
    expect(rangeSortValue("Touch")).toBe(1);
    expect(rangeSortValue("30 feet")).toBe(30);
    expect(rangeSortValue("120 feet")).toBe(120);
    expect(rangeSortValue("Sight")).toBeGreaterThan(120);
  });
});

describe("compareCandidates", () => {
  it("sorts by level ascending then name", () => {
    const a = cand({ name: "Bless", level: 1 });
    const b = cand({ name: "Aid", level: 2 });
    expect(compareCandidates(a, b, "level", "asc")).toBeLessThan(0);
    expect(compareCandidates(a, b, "level", "desc")).toBeGreaterThan(0);
  });
  it("sorts by name", () => {
    const a = cand({ name: "Aid" }), b = cand({ name: "Bless" });
    expect(compareCandidates(a, b, "name", "asc")).toBeLessThan(0);
  });
  it("missing damage sorts last in ascending", () => {
    const has = cand({ name: "A", entity: { damage: { types: ["fire"] } } });
    const none = cand({ name: "B", entity: {} });
    expect(compareCandidates(has, none, "damage", "asc")).toBeLessThan(0);
  });
});
