import { describe, it, expect } from "vitest";
import { detectFormula, resolveFormulaTag } from "../src/dnd/formula-tags";
import type { MonsterAbilities } from "../src/types/monster";

describe("detectFormula", () => {
  it("detects ability name in atk tag", () => {
    expect(detectFormula("atk", "DEX")).toEqual({ ability: "dex", kind: "attack" });
  });
  it("detects ability name in damage tag", () => {
    expect(detectFormula("damage", "1d6+DEX")).toEqual({ ability: "dex", kind: "damage" });
  });
  it("detects ability name in dc tag", () => {
    expect(detectFormula("dc", "WIS")).toEqual({ ability: "wis", kind: "dc" });
  });
  it("returns null for static atk value", () => { expect(detectFormula("atk", "+5")).toBeNull(); });
  it("returns null for static damage value", () => { expect(detectFormula("damage", "2d8+3")).toBeNull(); });
  it("returns null for static dc value", () => { expect(detectFormula("dc", "15")).toBeNull(); });
  it("is case-insensitive", () => {
    expect(detectFormula("atk", "str")).toEqual({ ability: "str", kind: "attack" });
    expect(detectFormula("dc", "Con")).toEqual({ ability: "con", kind: "dc" });
  });
  it("returns null for non-rollable types", () => { expect(detectFormula("check", "Perception")).toBeNull(); });
});

describe("resolveFormulaTag", () => {
  const abilities: MonsterAbilities = { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 };
  const profBonus = 2;
  it("resolves atk:DEX -> +4", () => { expect(resolveFormulaTag("atk", "DEX", abilities, profBonus)).toBe("+4"); });
  it("resolves atk:STR -> +1", () => { expect(resolveFormulaTag("atk", "STR", abilities, profBonus)).toBe("+1"); });
  it("resolves damage:1d6+DEX -> 1d6+2", () => { expect(resolveFormulaTag("damage", "1d6+DEX", abilities, profBonus)).toBe("1d6+2"); });
  it("resolves damage:2d10+STR -> 2d10-1", () => { expect(resolveFormulaTag("damage", "2d10+STR", abilities, profBonus)).toBe("2d10-1"); });
  it("resolves dc:WIS -> DC 9", () => { expect(resolveFormulaTag("dc", "WIS", abilities, profBonus)).toBe("DC 9"); });
  it("resolves dc:CON -> DC 10", () => { expect(resolveFormulaTag("dc", "CON", abilities, profBonus)).toBe("DC 10"); });
  it("returns static values unchanged", () => {
    expect(resolveFormulaTag("atk", "+5", abilities, profBonus)).toBe("+5");
    expect(resolveFormulaTag("damage", "2d8+3", abilities, profBonus)).toBe("2d8+3");
  });
});
