import { describe, it, expect } from "vitest";
import { defaultFilters, matchesFilters, activeFacetCount, resetFacets } from "../packages/obsidian/src/modules/pc/components/spells/spell-filter";
import type { SpellCandidate } from "@archivist/dnd5e/spell/spell.access";

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
