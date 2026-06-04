import { describe, it, expect } from "vitest";
import { deriveSpellSlots, type CasterClassInput } from "../src/modules/pc/pc.spellcasting";

const c = (classSlug: string, level: number): CasterClassInput => ({ classSlug, level });

describe("deriveSpellSlots", () => {
  it("single full caster uses its own table (Wizard 5 → 4/3/2)", () => {
    const r = deriveSpellSlots([c("wizard", 5)], "2014");
    expect(r.standard).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(r.pact).toBeNull();
  });

  it("single half caster uses the half table (Paladin 5 → 4/2, NOT caster-level-2)", () => {
    const r = deriveSpellSlots([c("paladin", 5)], "2014");
    expect(r.standard).toEqual({ 1: 4, 2: 2 });
  });

  it("Paladin 1 has no slots", () => {
    expect(deriveSpellSlots([c("paladin", 1)], "2014").standard).toEqual({});
  });

  it("multiclass combines: Cleric 3 / Wizard 2 → caster level 5 → 4/3/2", () => {
    const r = deriveSpellSlots([c("cleric", 3), c("wizard", 2)], "2014");
    expect(r.standard).toEqual({ 1: 4, 2: 3, 3: 2 });
  });

  it("multiclass half rounds down: Paladin 5 / Sorcerer 1 → CL floor(5/2)+1 = 3 → 4/2", () => {
    const r = deriveSpellSlots([c("paladin", 5), c("sorcerer", 1)], "2014");
    expect(r.standard).toEqual({ 1: 4, 2: 2 });
  });

  // Spec §4.1: two-or-more casters pool half levels BEFORE flooring —
  // CL = sum(full) + floor(sum(half)/2). Paladin 1 + Ranger 1 → floor(2/2) = CL 1.
  // (Per-class flooring, floor(1/2)+floor(1/2)=0, would be wrong — guard against it.)
  it("multiclass pools half levels before flooring: Paladin 1 / Ranger 1 → CL 1 → 2×1st", () => {
    const r = deriveSpellSlots([c("paladin", 1), c("ranger", 1)], "2014");
    expect(r.standard).toEqual({ 1: 2 });
  });

  it("multiclass pools half levels before flooring: Paladin 3 / Ranger 1 → CL floor(4/2)=2 → 3×1st", () => {
    const r = deriveSpellSlots([c("paladin", 3), c("ranger", 1)], "2014");
    expect(r.standard).toEqual({ 1: 3 });
  });

  it("warlock pact is separate and does not combine: Warlock 3 / Sorcerer 2", () => {
    const r = deriveSpellSlots([c("warlock", 3), c("sorcerer", 2)], "2014");
    expect(r.standard).toEqual({ 1: 3 });           // sorcerer 2 alone, single full caster
    expect(r.pact).toEqual({ level: 2, total: 2 }); // warlock 3
  });

  it("single warlock has only pact magic", () => {
    const r = deriveSpellSlots([c("warlock", 5)], "2014");
    expect(r.standard).toEqual({});
    expect(r.pact).toEqual({ level: 3, total: 2 });
  });

  it("non-casters produce nothing", () => {
    expect(deriveSpellSlots([c("fighter", 5)], "2014")).toEqual({ standard: {}, pact: null });
  });
});
