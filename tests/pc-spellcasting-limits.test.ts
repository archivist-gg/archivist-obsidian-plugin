import { describe, it, expect } from "vitest";
import { computeSpellLimits, type LimitClassInput } from "../src/modules/pc/pc.spellcasting";

// Minimal class-table stub: only columns the limit reader looks at.
function wizardEntity() {
  return {
    slug: "wizard",
    table: { 5: { prof_bonus: 3, feature_ids: [], columns: { "Cantrips Known": "4" } } },
  } as never;
}
function sorcererEntity() {
  return {
    slug: "sorcerer",
    table: { 5: { prof_bonus: 3, feature_ids: [], columns: { "Cantrips Known": "5", "Spells Known": "6" } } },
  } as never;
}

const inp = (classSlug: string, level: number, entity: unknown, abilityScore: number): LimitClassInput =>
  ({ classSlug, level, entity: entity as never, abilityScore });

describe("computeSpellLimits", () => {
  it("prepared full caster: prepared = abilityMod + classLevel (Wizard 5, INT 16 → 3+5=8)", () => {
    const [lim] = computeSpellLimits([inp("wizard", 5, wizardEntity(), 16)], "2014");
    expect(lim.kind).toBe("prepared");
    expect(lim.cantripsKnown).toBe(4);
    expect(lim.preparedOrKnown).toBe(8);
  });

  it("prepared half caster: Paladin 6, CHA 16 → 3 + floor(6/2)=3 → 6", () => {
    const pal = { slug: "paladin", table: {} } as never;
    const [lim] = computeSpellLimits([inp("paladin", 6, pal, 16)], "2014");
    expect(lim.preparedOrKnown).toBe(6);
  });

  it("known caster reads Spells Known column (Sorcerer 5 → 6)", () => {
    const [lim] = computeSpellLimits([inp("sorcerer", 5, sorcererEntity(), 16)], "2014");
    expect(lim.kind).toBe("known");
    expect(lim.cantripsKnown).toBe(5);
    expect(lim.preparedOrKnown).toBe(6);
  });

  it("prepared count floors at 1", () => {
    const cl = { slug: "cleric", table: {} } as never;
    const [lim] = computeSpellLimits([inp("cleric", 1, cl, 8)], "2014"); // WIS 8 → mod -1; -1+1=0 → floor at 1
    expect(lim.preparedOrKnown).toBe(1);
  });

  it("skips non-casters", () => {
    const fi = { slug: "fighter", table: {} } as never;
    expect(computeSpellLimits([inp("fighter", 5, fi, 14)], "2014")).toEqual([]);
  });
});
