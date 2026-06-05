import { describe, it, expect } from "vitest";
import { seedFeatureUses } from "../src/modules/pc/pc.resource-seed";
import type { ResolvedCharacter, DerivedStats } from "../src/modules/pc/pc.types";

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

  it("applies scales_at at the character's total level", () => {
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
