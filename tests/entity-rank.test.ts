import { describe, it, expect } from "vitest";
import type { RegisteredEntity } from "@archivist-gg/core";
import { rankEntities } from "../packages/obsidian/src/shared/entity-rank";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

/** The pool the bounded ranker walks: `getAllSlugs()` iteration order resolved
 *  through `getBySlug()`. Provably the same order core's untyped `search`
 *  enumerates (`Array.from(this.bySlug.values())`) — both are `bySlug` key
 *  order — which is what makes the parity assertions below meaningful. */
function poolOf(reg: ReturnType<typeof buildMockRegistry>): RegisteredEntity[] {
  const out: RegisteredEntity[] = [];
  for (const slug of reg.getAllSlugs()) {
    const e = reg.getBySlug(slug);
    if (e) out.push(e);
  }
  return out;
}

/** `EntityRegistry.search` is untyped under the one-off tests tsconfig, so the
 *  oracle side goes through this helper rather than an inline callback. */
const slugsOf = (list: RegisteredEntity[]): string[] => list.map((e) => e.slug);

const spell = (slug: string, name: string, compendium = "SRD 5e") => ({
  slug,
  name,
  entityType: "spell",
  data: {},
  compendium,
});

describe("rankEntities · parity with EntityRegistry.search", () => {
  /** Exact / prefix / contains-only all present, plus a non-match control.
   *  "Circle of Fire" is load-bearing: it is a contains-only match that sorts
   *  ALPHABETICALLY AHEAD of every prefix match, so the prefix tier is the only
   *  thing keeping it last. Without it the fixture happens to come out in the
   *  same order with or without that tier, and the parity assertions go vacuous. */
  const tiers = buildMockRegistry([
    spell("srd_spell_wall-of-fire", "Wall of Fire"),   // contains-only
    spell("srd_spell_firebolt", "Firebolt"),           // prefix
    spell("srd_spell_fire", "Fire"),                   // EXACT
    spell("srd_spell_ice-storm", "Ice Storm"),         // no match
    spell("srd_spell_fireball", "Fireball"),           // prefix
    spell("srd_spell_circle-of-fire", "Circle of Fire"), // contains-only, sorts FIRST
  ]);

  it("orders exact > prefix > alphabetical, identically to registry.search", () => {
    const oracle = tiers.search("fire", undefined, 20);
    const ranked = rankEntities(poolOf(tiers), "fire", 20);

    expect(ranked.map((e) => e.name)).toEqual([
      "Fire",           // exact
      "Fireball",       // prefix
      "Firebolt",       // prefix
      "Circle of Fire", // contains-only, though it sorts first alphabetically
      "Wall of Fire",   // contains-only
    ]);
    expect(slugsOf(ranked)).toEqual(slugsOf(oracle));
  });

  it("drops non-matching names (contains is the filter, case-insensitive)", () => {
    expect(slugsOf(rankEntities(poolOf(tiers), "FIRE", 20)))
      .toEqual(slugsOf(tiers.search("FIRE", undefined, 20)));
    expect(rankEntities(poolOf(tiers), "fire", 20).some((e) => e.name === "Ice Storm")).toBe(false);
  });

  it("empty query matches every entity, in pool order", () => {
    expect(slugsOf(rankEntities(poolOf(tiers), "", 20)))
      .toEqual(slugsOf(tiers.search("", undefined, 20)));
  });

  it("a bounded limit equals sort-then-slice", () => {
    for (const limit of [1, 2, 3, 4, 10]) {
      expect(slugsOf(rankEntities(poolOf(tiers), "fire", limit)))
        .toEqual(slugsOf(tiers.search("fire", undefined, limit)));
    }
  });

  it("POSITIVE_INFINITY never truncates", () => {
    expect(rankEntities(poolOf(tiers), "fire", Number.POSITIVE_INFINITY)).toHaveLength(5);
  });
});

describe("rankEntities · TIE resolution is POOL ORDER (first seen wins)", () => {
  // Three entities that COLLIDE on name: every tier test in the comparator is a
  // draw and `localeCompare` returns 0, so the ONLY thing that can order them is
  // arrival order. Registered c, a, b — deliberately NOT slug-alphabetical, so a
  // ranker that sorted by slug (or that replaced an equal incumbent) is caught.
  const ties = buildMockRegistry([
    spell("c_spell_fireball", "Fireball", "C Compendium"),
    spell("a_spell_fireball", "Fireball", "A Compendium"),
    spell("b_spell_fireball", "Fireball", "B Compendium"),
  ]);

  it("keeps duplicated names in pool order, matching core's stable sort", () => {
    const oracle: RegisteredEntity[] = ties.search("fireball", undefined, 20);
    expect(slugsOf(oracle)).toEqual([
      "c_spell_fireball",
      "a_spell_fireball",
      "b_spell_fireball",
    ]);
    expect(slugsOf(rankEntities(poolOf(ties), "fireball", 20)))
      .toEqual(slugsOf(oracle));
  });

  it("a tie under a TIGHT limit keeps the FIRST seen, never a later equal", () => {
    expect(slugsOf(rankEntities(poolOf(ties), "fireball", 1)))
      .toEqual(["c_spell_fireball"]);
    expect(slugsOf(rankEntities(poolOf(ties), "fireball", 2)))
      .toEqual(["c_spell_fireball", "a_spell_fireball"]);
  });

  it("ties INSIDE a tier resolve to pool order too (two exact, two prefix)", () => {
    const mixed = buildMockRegistry([
      spell("z_spell_fire", "Fire", "Z"),          // exact, seen first
      spell("m_spell_fireball", "Fireball", "M"),  // prefix, seen first
      spell("a_spell_fire", "Fire", "A"),          // exact, seen second
      spell("a_spell_fireball", "Fireball", "A"),  // prefix, seen second
    ]);
    expect(slugsOf(rankEntities(poolOf(mixed), "fire", 20))).toEqual([
      "z_spell_fire",
      "a_spell_fire",
      "m_spell_fireball",
      "a_spell_fireball",
    ]);
    expect(slugsOf(rankEntities(poolOf(mixed), "fire", 20)))
      .toEqual(slugsOf(mixed.search("fire", undefined, 20)));
  });
});

describe("rankEntities · the filter runs FIRST", () => {
  const reg = buildMockRegistry([
    spell("hidden_spell_fire", "Fire", "Hidden HB"),        // EXACT but filtered
    spell("srd_spell_fireball", "Fireball", "SRD 5e"),
    spell("hidden_spell_fireb", "Fireb", "Hidden HB"),      // prefix but filtered
    spell("srd_spell_wall-of-fire", "Wall of Fire", "SRD 5e"),
  ]);
  const visible = (e: RegisteredEntity) => e.compendium !== "Hidden HB";

  it("a filtered EXACT match never appears, and never occupies a slot", () => {
    const out = rankEntities(poolOf(reg), "fire", 20, visible);
    expect(out.map((e) => e.slug)).toEqual(["srd_spell_fireball", "srd_spell_wall-of-fire"]);
    expect(out.some((e) => e.compendium === "Hidden HB")).toBe(false);
  });

  it("filter-before-cap: filtered matches can never starve the cap", () => {
    const entries = [];
    for (let i = 0; i < 25; i++) {
      entries.push(spell(`h_spell_a${i}`, `Aspell ${i}`, "Hidden HB"));
      entries.push(spell(`v_spell_b${i}`, `Aspell z${i}`, "Visible HB"));
    }
    const out = rankEntities(poolOf(buildMockRegistry(entries)), "aspell", 20, visible);
    expect(out).toHaveLength(20);
    expect(out.every((e) => e.compendium === "Visible HB")).toBe(true);
  });

  it("no filter argument means no filtering", () => {
    expect(rankEntities(poolOf(reg), "fire", 20)).toHaveLength(4);
  });
});
