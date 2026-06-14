import { describe, it, expect } from "vitest";
import { deriveSpellSlots } from "../src/modules/pc/pc.spellcasting";

describe("deriveSpellSlots — dedicated third caster (bug fix)", () => {
  it("single third-caster matches the Eldritch Knight/Arcane Trickster/Architect table", () => {
    expect(deriveSpellSlots([{ casterType: "third", level: 3 }]).standard).toEqual({ 1: 2 });
    expect(deriveSpellSlots([{ casterType: "third", level: 7 }]).standard).toEqual({ 1: 4, 2: 2 });
    expect(deriveSpellSlots([{ casterType: "third", level: 13 }]).standard).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(deriveSpellSlots([{ casterType: "third", level: 20 }]).standard).toEqual({ 1: 4, 2: 3, 3: 3, 4: 1 });
  });
  it("third caster below level 3 has no slots", () => {
    expect(deriveSpellSlots([{ casterType: "third", level: 2 }]).standard).toEqual({});
  });
});

describe("deriveSpellSlots — full / half / pact / multiclass", () => {
  it("single full caster uses its own table (Wizard 5 → 4/3/2)", () => {
    const r = deriveSpellSlots([{ casterType: "full", level: 5 }]);
    expect(r.standard).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(r.pact).toBeNull();
  });
  it("single half caster uses the half table (Paladin 5 → 4/2, NOT caster-level-2)", () => {
    expect(deriveSpellSlots([{ casterType: "half", level: 5 }]).standard).toEqual({ 1: 4, 2: 2 });
  });
  it("Paladin 1 has no slots", () => {
    expect(deriveSpellSlots([{ casterType: "half", level: 1 }]).standard).toEqual({});
  });
  it("multiclass combines: Cleric 3 / Wizard 2 → caster level 5 → 4/3/2", () => {
    expect(deriveSpellSlots([{ casterType: "full", level: 3 }, { casterType: "full", level: 2 }]).standard).toEqual({ 1: 4, 2: 3, 3: 2 });
  });
  it("multiclass half rounds down: Paladin 5 / Sorcerer 1 → CL floor(5/2)+1 = 3 → 4/2", () => {
    expect(deriveSpellSlots([{ casterType: "half", level: 5 }, { casterType: "full", level: 1 }]).standard).toEqual({ 1: 4, 2: 2 });
  });
  // Spec §4.1: two-or-more casters pool half levels BEFORE flooring —
  // CL = sum(full) + floor(sum(half)/2). Paladin 1 + Ranger 1 → floor(2/2) = CL 1.
  // (Per-class flooring, floor(1/2)+floor(1/2)=0, would be wrong — guard against it.)
  it("multiclass pools half levels before flooring: Paladin 1 / Ranger 1 → CL 1 → 2×1st", () => {
    expect(deriveSpellSlots([{ casterType: "half", level: 1 }, { casterType: "half", level: 1 }]).standard).toEqual({ 1: 2 });
  });
  it("multiclass pools half levels before flooring: Paladin 3 / Ranger 1 → CL floor(4/2)=2 → 3×1st", () => {
    expect(deriveSpellSlots([{ casterType: "half", level: 3 }, { casterType: "half", level: 1 }]).standard).toEqual({ 1: 3 });
  });
  // Third caster contributes floor(thirdLevels/3) ONLY when multiclassed with another caster.
  it("multiclass with third caster: Full 6 + Third 9 → CL 6 + floor(9/3)=3 → 9", () => {
    expect(deriveSpellSlots([{ casterType: "full", level: 6 }, { casterType: "third", level: 9 }]).standard).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
  });
  it("warlock pact is separate and does not combine: Warlock 3 / Sorcerer 2", () => {
    const r = deriveSpellSlots([{ casterType: "pact", level: 3 }, { casterType: "full", level: 2 }]);
    expect(r.standard).toEqual({ 1: 3 });
    expect(r.pact).toEqual({ level: 2, total: 2 });
  });
  it("single warlock has only pact magic", () => {
    const r = deriveSpellSlots([{ casterType: "pact", level: 5 }]);
    expect(r.standard).toEqual({});
    expect(r.pact).toEqual({ level: 3, total: 2 });
  });
  it("empty input (all non-casters filtered upstream) produces nothing", () => {
    expect(deriveSpellSlots([])).toEqual({ standard: {}, pact: null });
  });
});
