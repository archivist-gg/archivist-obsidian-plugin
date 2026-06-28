import { describe, it, expect } from "vitest";
import { castTimeCategory, rangeCategory } from "../packages/obsidian/src/modules/pc/components/spells/spell-filter";

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

import { castTimeRank, rangeSortValue, compareCandidates } from "../packages/obsidian/src/modules/pc/components/spells/spell-filter";
import type { SpellCandidate } from "../packages/obsidian/src/modules/pc/components/spells/spell-access";

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

import { defaultFilters, matchesFilters, activeFacetCount, resetFacets } from "../packages/obsidian/src/modules/pc/components/spells/spell-filter";

const spell = (e: object): SpellCandidate => ({ slug: "x", name: "X", level: (e as { level?: number }).level ?? 1, entity: e as never });

describe("matchesFilters", () => {
  it("empty filters match everything", () => {
    expect(matchesFilters(spell({ school: "evocation" }), defaultFilters())).toBe(true);
  });
  it("OR within a group: Damage {acid,cold} matches acid and cold, not fire", () => {
    const f = defaultFilters(); f.damages = new Set(["acid", "cold"]);
    expect(matchesFilters(spell({ damage: { types: ["acid"] } }), f)).toBe(true);
    expect(matchesFilters(spell({ damage: { types: ["cold"] } }), f)).toBe(true);
    expect(matchesFilters(spell({ damage: { types: ["fire"] } }), f)).toBe(false);
  });
  it("AND across groups: Level{1} and School{evocation}", () => {
    const f = defaultFilters(); f.levels = new Set([1]); f.schools = new Set(["evocation"]);
    expect(matchesFilters(spell({ level: 1, school: "evocation" }), f)).toBe(true);
    expect(matchesFilters(spell({ level: 1, school: "enchantment" }), f)).toBe(false);
  });
  it("flags require the boolean", () => {
    const f = defaultFilters(); f.concentration = true;
    expect(matchesFilters(spell({ concentration: true }), f)).toBe(true);
    expect(matchesFilters(spell({ concentration: false }), f)).toBe(false);
  });
  it("save filter normalizes word/abbrev via abbrAbility", () => {
    const f = defaultFilters(); f.saves = new Set(["dex"]);
    expect(matchesFilters(spell({ saving_throw: { ability: "dexterity" } }), f)).toBe(true);
    expect(matchesFilters(spell({ saving_throw: { ability: "wisdom" } }), f)).toBe(false);
  });
});

describe("activeFacetCount + resetFacets", () => {
  it("counts active hidden sections and clears them", () => {
    const f = defaultFilters(); f.schools = new Set(["evocation"]); f.ritual = true;
    expect(activeFacetCount(f)).toBe(2);
    resetFacets(f);
    expect(activeFacetCount(f)).toBe(0);
    expect(f.schools.size).toBe(0);
    expect(f.ritual).toBe(false);
  });
});
