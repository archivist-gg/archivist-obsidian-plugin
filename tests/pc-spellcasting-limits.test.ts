import { describe, it, expect } from "vitest";
import { computeSpellLimits, type LimitClassInput, type SpellcastingProfile } from "../packages/obsidian/src/modules/pc/pc.spellcasting";

const profile = (over: Partial<SpellcastingProfile> = {}): SpellcastingProfile =>
  ({ ability: "int", casterType: "full", preparation: "prepared", spellList: "wizard", table: {}, ...over });

const inp = (classSlug: string, level: number, p: SpellcastingProfile, abilityScore: number): LimitClassInput =>
  ({ classSlug, level, profile: p, abilityScore });

describe("computeSpellLimits", () => {
  it("prepared full caster: prepared = abilityMod + classLevel (Wizard 5, INT 16 → 3+5=8)", () => {
    const wiz = profile({ table: { 5: { columns: { "Cantrips Known": "4" } } } });
    const [lim] = computeSpellLimits([inp("wizard", 5, wiz, 16)]);
    expect(lim.kind).toBe("prepared");
    expect(lim.cantripsKnown).toBe(4);
    expect(lim.preparedOrKnown).toBe(8);
  });

  it("prepared half caster: Paladin 6, CHA 16 → 3 + floor(6/2)=3 → 6", () => {
    const pal = profile({ ability: "cha", casterType: "half", preparation: "prepared", spellList: "paladin" });
    const [lim] = computeSpellLimits([inp("paladin", 6, pal, 16)]);
    expect(lim.preparedOrKnown).toBe(6);
  });

  it("known caster reads Spells Known column (Sorcerer 5 → 6)", () => {
    const sor = profile({ ability: "cha", casterType: "full", preparation: "known", spellList: "sorcerer", table: { 5: { columns: { "Cantrips Known": "5", "Spells Known": "6" } } } });
    const [lim] = computeSpellLimits([inp("sorcerer", 5, sor, 16)]);
    expect(lim.kind).toBe("known");
    expect(lim.cantripsKnown).toBe(5);
    expect(lim.preparedOrKnown).toBe(6);
  });

  it("prepared count floors at 1", () => {
    const cle = profile({ ability: "wis", casterType: "full", preparation: "prepared", spellList: "cleric" });
    const [lim] = computeSpellLimits([inp("cleric", 1, cle, 8)]); // WIS 8 → mod -1; -1+1=0 → floor at 1
    expect(lim.preparedOrKnown).toBe(1);
  });

  it("empty input (non-casters filtered upstream) → []", () => {
    expect(computeSpellLimits([])).toEqual([]);
  });
});
