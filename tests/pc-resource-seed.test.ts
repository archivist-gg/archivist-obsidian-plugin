import { describe, it, expect, vi } from "vitest";
import { seedFeatureUses } from "../packages/obsidian/src/modules/pc/pc.resource-seed";
import type { ResolvedCharacter, DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";

function derived(over: Partial<DerivedStats> = {}): DerivedStats {
  return {
    proficiencyBonus: 3,
    mods: { str: 1, dex: 2, con: 3, int: 0, wis: 1, cha: 4 },
    ...over,
  } as unknown as DerivedStats;
}

function resolved(features: object[], totalLevel: number, classes: object[], featureUses = {}): ResolvedCharacter {
  return {
    totalLevel,
    classes,
    features,
    state: { feature_uses: featureUses },
  } as unknown as ResolvedCharacter;
}

describe("seedFeatureUses", () => {
  it("evaluates a flat max into feature_uses, preserving used=0", () => {
    const r = resolved(
      [{ feature: { name: "Second Wind", resources: [{ id: "fighter:second-wind", name: "Second Wind", max_formula: "1", reset: "short-rest" }] }, source: { kind: "class", slug: "fighter", level: 1 } }],
      5,
      [{ entity: { slug: "fighter" }, level: 5 }],
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["fighter:second-wind"]).toEqual({ used: 0, max: 1 });
  });

  it("applies scales_at at the OWNER's class level (this fixture's class and total levels coincide)", () => {
    const r = resolved(
      [{ feature: { name: "Rage", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "2", scales_at: [{ level: 3, max: "3" }, { level: 6, max: "4" }], reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      6,
      [{ entity: { slug: "barbarian" }, level: 6 }],
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["barbarian:rage"].max).toBe(4);
  });

  it("binds class_level to the GRANTING class, not total level", () => {
    const r = resolved(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sorcerer:sorcery-points", name: "Sorcery Points", max_formula: "class_level", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      8,                                   // total level 8 …
      [{ entity: { slug: "fighter" }, level: 5 }, { entity: { slug: "sorcerer" }, level: 3 }],
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["sorcerer:sorcery-points"].max).toBe(3);   // … but 3 sorcerer levels
  });

  it("binds {cha_mod} from derived mods", () => {
    const r = resolved(
      [{ feature: { name: "Bardic", resources: [{ id: "bard:bardic-inspiration", name: "Bardic Inspiration", max_formula: "{cha_mod}", reset: "short-rest" }] }, source: { kind: "class", slug: "bard", level: 1 } }],
      5,
      [{ entity: { slug: "bard" }, level: 5 }],
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["bard:bardic-inspiration"].max).toBe(4);   // cha_mod = 4
  });

  it("merges two grants of the same id by max()", () => {
    const mk = (slug: string, lvl: number) => ({ feature: { name: "Channel Divinity", resources: [{ id: "channel-divinity", name: "Channel Divinity", max_formula: "class_level", reset: "short-rest" }] }, source: { kind: "class", slug, level: 1 } });
    const r = resolved([mk("cleric", 6), mk("paladin", 3)], 9,
      [{ entity: { slug: "cleric" }, level: 6 }, { entity: { slug: "paladin" }, level: 3 }]);
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["channel-divinity"].max).toBe(6);   // max(6,3)
  });

  it("preserves used and clamps it down when max shrinks", () => {
    const r = resolved(
      [{ feature: { name: "Rage", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "2", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      2,
      [{ entity: { slug: "barbarian" }, level: 2 }],
      { "barbarian:rage": { used: 5, max: 6 } },
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["barbarian:rage"]).toEqual({ used: 2, max: 2 });
  });

  it("skips a feature with no resources", () => {
    const r = resolved(
      [{ feature: { name: "X" }, source: { kind: "class", slug: "fighter", level: 1 } }],
      5,
      [{ entity: { slug: "fighter" }, level: 5 }],
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses).toEqual({});
  });

  it("leaves feature_uses untouched when there are no features", () => {
    const r = resolved([], 5, [], { keep: { used: 1, max: 2 } });
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses).toEqual({ keep: { used: 1, max: 2 } });
  });

  it("skips a resource with an empty-string id", () => {
    const r = resolved(
      [{ feature: { name: "X", resources: [{ id: "", name: "X", max_formula: "1", reset: "short-rest" }] }, source: { kind: "class", slug: "fighter", level: 1 } }],
      5,
      [{ entity: { slug: "fighter" }, level: 5 }],
    );
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses).toEqual({});
  });
});

describe("seedFeatureUses — column() from the (sub)class table", () => {
  it("column('Seals') reads the granting class table at the class level", () => {
    const r = {
      totalLevel: 5,
      classes: [{ entity: { slug: "reaver", table: { 5: { columns: { Seals: 4 } } } }, level: 5 }],
      features: [{
        feature: { name: "Baleful Interdict", resources: [{ id: "reaver:seals", name: "Seals", max_formula: "column('Seals')", reset: "long-rest" }] },
        source: { kind: "class", slug: "reaver", level: 1 },
      }],
      state: { feature_uses: {} },
    } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["reaver:seals"].max).toBe(4);
  });

  it("reads the SUBCLASS table for a subclass-sourced resource", () => {
    const r = {
      totalLevel: 5,
      classes: [{
        entity: { slug: "reaver", table: { 5: { columns: {} } } },
        level: 5,
        subclass: { slug: "architect-of-ruin", table: { 5: { columns: { "Conduit Dice": 2 } } } },
      }],
      features: [{
        feature: { name: "Infernal Conduit", resources: [{ id: "reaver:conduit", name: "Conduit Dice", max_formula: "column('Conduit Dice')", reset: "short-rest" }] },
        source: { kind: "subclass", slug: "architect-of-ruin", level: 3 },
      }],
      state: { feature_uses: {} },
    } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["reaver:conduit"].max).toBe(2);
  });

  it("binds class_level to the owning class for a subclass-sourced resource", () => {
    const r = {
      totalLevel: 9,
      classes: [
        { entity: { slug: "fighter" }, level: 4 },
        { entity: { slug: "reaver" }, level: 5, subclass: { slug: "architect-of-ruin" } },
      ],
      features: [{
        feature: { name: "Sub", resources: [{ id: "sub:res", name: "Sub", max_formula: "class_level", reset: "long-rest" }] },
        source: { kind: "subclass", slug: "architect-of-ruin", level: 3 },
      }],
      state: { feature_uses: {} },
    } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["sub:res"].max).toBe(5); // reaver level, not total 9
  });

  it("a column-driven max with no table row resolves to 0", () => {
    const r = {
      totalLevel: 1,
      classes: [{ entity: { slug: "reaver" }, level: 1 }],
      features: [{
        feature: { name: "X", resources: [{ id: "x", name: "X", max_formula: "column('Seals')", reset: "long-rest" }] },
        source: { kind: "class", slug: "reaver", level: 1 },
      }],
      state: { feature_uses: {} },
    } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["x"].max).toBe(0);
  });
});

describe("R4-G4 §6.2.5 · the OWNER's class level, the warned continue", () => {
  const rage = (slug: string) => ({ feature: { name: "Rage", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "2",
    scales_at: [{ level: 3, max: "3" }, { level: 6, max: "4" }, { level: 12, max: "5" }], reset: "long-rest" }] },
    source: { kind: "class", slug, level: 1 } });

  it("RED FIRST: a Barbarian 5 / Fighter 5 seeds Rage at the CLASS level (3), not the total level (4)", () => {
    const r = resolved([rage("barbarian")], 10, [{ entity: { slug: "barbarian" }, level: 5 }, { entity: { slug: "fighter" }, level: 5 }]);
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["barbarian:rage"].max).toBe(3);
  });

  it("RED FIRST: the PHB 2024 Bard's Bardic Inspiration (die-string steps) seeds the base COUNT instead of vanishing", () => {
    const bard = { feature: { name: "Bardic Inspiration", resources: [{ id: "bard:bardic-die", name: "Bardic Inspiration", max_formula: "{cha_mod}",
      scales_at: [{ level: 5, max: "1d8" }, { level: 10, max: "1d10" }, { level: 15, max: "1d12" }], reset: "long-rest" }] },
      source: { kind: "class", slug: "bard", level: 1 } };
    const r = resolved([bard], 5, [{ entity: { slug: "bard" }, level: 5 }]);
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["bard:bardic-die"]).toEqual({ used: 0, max: 4 });   // cha_mod 4
  });

  it("RED FIRST: an unparseable base (Sneak Attack 1d6) is warned ONCE and left un-seeded, not swallowed", async () => {
    const { __resetWarnOnceForTests } = await import("@archivist-gg/dnd5e/dnd/warn-once");
    __resetWarnOnceForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sneak = { feature: { name: "Sneak Attack", resources: [{ id: "rogue:sneak-attack", name: "Sneak Attack", max_formula: "1d6", reset: "turn" }] },
      source: { kind: "class", slug: "rogue", level: 1 } };
    const r = resolved([sneak, sneak], 5, [{ entity: { slug: "rogue" }, level: 5 }]);
    seedFeatureUses(r, derived());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(" ")).toContain("rogue:sneak-attack");
    expect(r.state.feature_uses["rogue:sneak-attack"]).toBeUndefined();
    warn.mockRestore();
  });

  it("min-1 data reads 1 at a +0 modifier (the clamp lives in DATA, the reader floor stays 0)", () => {
    const luck = { feature: { name: "Dark One's Own Luck", resources: [{ id: "fiend-patron:dark-ones-own-luck", name: "Dark One's Own Luck", max_formula: "max(1, {cha_mod})", reset: "short-rest" }] },
      source: { kind: "subclass", slug: "fiend", level: 1 } };
    const r = resolved([luck], 3, [{ entity: { slug: "warlock" }, level: 3, subclass: { slug: "fiend" } }]);
    seedFeatureUses(r, derived({ mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } } as never));
    expect(r.state.feature_uses["fiend-patron:dark-ones-own-luck"].max).toBe(1);
  });
});

/** The `resolved` helper above builds a features-only cast, so a POOL-owned entry has to be attached
 *  by hand: `resolveResourceIndex`'s pool walk is what fills this map in production, and the seed's
 *  second walk (R4-G4 §12) is the ONLY route by which a pick's `uses.max` becomes a `feature_uses`
 *  key. Without these two cases the block has zero kill power (review I-1). */
const withIndex = (r: ResolvedCharacter, entries: Array<[string, object]>): ResolvedCharacter => {
  (r as { resources?: unknown }).resources = new Map(entries);
  return r;
};
const poolRes = (id: string, maxFormula: string, slug: string) => ({
  id, name: id, reset: "long-rest", maxFormula,
  owner: { kind: "pool", poolId: "invocations", poolLabel: "Eldritch Invocations", source: { kind: "class", slug, level: 1 } },
});
const cha3 = () => derived({ mods: { str: 1, dex: 2, con: 3, int: 0, wis: 1, cha: 3 } } as never);

describe("seedFeatureUses · the POOL-owned walk (R4-G4 §12)", () => {
  it("RED FIRST (m34b): a pool-owned index entry seeds feature_uses from the pick's own uses.max", () => {
    // Bond of the Talisman is a real TCE invocation whose `uses.max` is prose; `{cha_mod}` stands in
    // for the parseable shape the walk indexes, bound at the OWNING class's level through
    // `resourceBindings`. cha_mod 3 → max 3, and `used` starts at 0.
    const r = withIndex(
      resolved([], 5, [{ entity: { slug: "warlock" }, level: 5 }]),
      [["hb_talisman", poolRes("hb_talisman", "{cha_mod}", "warlock")]],
    );
    seedFeatureUses(r, cha3());
    expect(r.state.feature_uses["hb_talisman"]).toEqual({ used: 0, max: 3 });
  });

  it("merges max-of-maxes ACROSS the two walks, in both directions", () => {
    // The seed's `computed` record is shared by the features walk and the pool walk, so the same id
    // reached by both keeps the LARGER max whichever walk saw it first. Constructed, not corpus:
    // `resolveResourceIndex` gives a colliding id to the FEATURE half, so a real index never carries
    // a pool-owned entry under a feature-declared id (review M-7). What is pinned here is the seed's
    // merge arithmetic, which a "last write wins" or a "skip if present" would each break one way.
    const feat = (max: string) => ({ feature: { name: "Runes", resources: [{ id: "collide", name: "Runes", max_formula: max, reset: "short-rest" }] },
      source: { kind: "class", slug: "fighter", level: 3 } });
    const poolWins = withIndex(resolved([feat("1")], 5, [{ entity: { slug: "fighter" }, level: 5 }]),
      [["collide", poolRes("collide", "{cha_mod}", "fighter")]]);
    seedFeatureUses(poolWins, cha3());
    expect(poolWins.state.feature_uses["collide"]).toEqual({ used: 0, max: 3 });   // pool 3 > feature 1

    const featureWins = withIndex(resolved([feat("4")], 5, [{ entity: { slug: "fighter" }, level: 5 }]),
      [["collide", poolRes("collide", "{cha_mod}", "fighter")]]);
    seedFeatureUses(featureWins, cha3());
    expect(featureWins.state.feature_uses["collide"]).toEqual({ used: 0, max: 4 });   // feature 4 > pool 3
  });
});
