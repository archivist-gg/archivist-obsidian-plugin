import { describe, it, expect } from "vitest";
import {
  abilityModifier, formatModifier, proficiencyBonusFromCR, crToXP,
  hitDiceSizeFromCreatureSize, hpFromHitDice, savingThrow, skillBonus,
  passivePerception, attackBonus, saveDC, abilityNameToKey, parseHitDiceFormula,
} from "../src/shared/dnd/math";

describe("abilityModifier", () => {
  it("score 10 -> +0", () => expect(abilityModifier(10)).toBe(0));
  it("score 11 -> +0", () => expect(abilityModifier(11)).toBe(0));
  it("score 1 -> -5", () => expect(abilityModifier(1)).toBe(-5));
  it("score 8 -> -1", () => expect(abilityModifier(8)).toBe(-1));
  it("score 14 -> +2", () => expect(abilityModifier(14)).toBe(2));
  it("score 20 -> +5", () => expect(abilityModifier(20)).toBe(5));
  it("score 30 -> +10", () => expect(abilityModifier(30)).toBe(10));
});

describe("formatModifier", () => {
  it("positive adds +", () => expect(formatModifier(3)).toBe("+3"));
  it("zero adds +", () => expect(formatModifier(0)).toBe("+0"));
  it("negative keeps -", () => expect(formatModifier(-2)).toBe("-2"));
});

describe("proficiencyBonusFromCR", () => {
  it("CR 0 -> +2", () => expect(proficiencyBonusFromCR("0")).toBe(2));
  it("CR 1/4 -> +2", () => expect(proficiencyBonusFromCR("1/4")).toBe(2));
  it("CR 5 -> +3", () => expect(proficiencyBonusFromCR("5")).toBe(3));
  it("CR 10 -> +4", () => expect(proficiencyBonusFromCR("10")).toBe(4));
  it("CR 17 -> +6", () => expect(proficiencyBonusFromCR("17")).toBe(6));
  it("CR 30 -> +9", () => expect(proficiencyBonusFromCR("30")).toBe(9));
  it("unknown CR defaults to +2", () => expect(proficiencyBonusFromCR("unknown")).toBe(2));
});

describe("crToXP", () => {
  it("CR 0 -> 10", () => expect(crToXP("0")).toBe(10));
  it("CR 1/4 -> 50", () => expect(crToXP("1/4")).toBe(50));
  it("CR 1 -> 200", () => expect(crToXP("1")).toBe(200));
  it("CR 30 -> 155000", () => expect(crToXP("30")).toBe(155000));
  it("unknown CR returns 0", () => expect(crToXP("unknown")).toBe(0));
});

describe("hitDiceSizeFromCreatureSize", () => {
  it("tiny -> d4", () => expect(hitDiceSizeFromCreatureSize("tiny")).toBe(4));
  it("small -> d6", () => expect(hitDiceSizeFromCreatureSize("small")).toBe(6));
  it("medium -> d8", () => expect(hitDiceSizeFromCreatureSize("medium")).toBe(8));
  it("large -> d10", () => expect(hitDiceSizeFromCreatureSize("large")).toBe(10));
  it("huge -> d12", () => expect(hitDiceSizeFromCreatureSize("huge")).toBe(12));
  it("gargantuan -> d20", () => expect(hitDiceSizeFromCreatureSize("gargantuan")).toBe(20));
  it("is case-insensitive", () => expect(hitDiceSizeFromCreatureSize("Large")).toBe(10));
  it("unknown defaults to d8", () => expect(hitDiceSizeFromCreatureSize("unknown")).toBe(8));
});

describe("hpFromHitDice", () => {
  it("Goblin: 2d6, CON +0 -> 7", () => expect(hpFromHitDice(2, 6, 0)).toBe(7));
  it("Goblin: 2d6, CON +2 -> 11", () => expect(hpFromHitDice(2, 6, 2)).toBe(11));
  it("Ancient Dragon: 21d20, CON +7 -> 367", () => expect(hpFromHitDice(21, 20, 7)).toBe(367));
  it("1d8, CON +1 -> 5", () => expect(hpFromHitDice(1, 8, 1)).toBe(5));
  it("negative CON mod reduces HP", () => expect(hpFromHitDice(1, 8, -1)).toBe(3));
  it("HP minimum is 1 even with terrible CON", () => expect(hpFromHitDice(1, 4, -5)).toBe(1));
});

describe("parseHitDiceFormula", () => {
  it("parses 2d6", () => expect(parseHitDiceFormula("2d6")).toEqual({ count: 2, size: 6 }));
  it("parses 21d20", () => expect(parseHitDiceFormula("21d20")).toEqual({ count: 21, size: 20 }));
  it("parses 1d8", () => expect(parseHitDiceFormula("1d8")).toEqual({ count: 1, size: 8 }));
  it("returns null for invalid input", () => expect(parseHitDiceFormula("not dice")).toBeNull());
  it("ignores trailing modifiers (2d6+3)", () => expect(parseHitDiceFormula("2d6+3")).toEqual({ count: 2, size: 6 }));
});

describe("savingThrow", () => {
  it("non-proficient: just ability mod", () => expect(savingThrow(14, false, 2)).toBe(2));
  it("proficient: ability mod + prof bonus", () => expect(savingThrow(14, true, 2)).toBe(4));
  it("negative mod non-proficient", () => expect(savingThrow(8, false, 2)).toBe(-1));
  it("negative mod proficient", () => expect(savingThrow(8, true, 3)).toBe(2));
});

describe("skillBonus", () => {
  it("none: just ability mod", () => expect(skillBonus(14, "none", 2)).toBe(2));
  it("proficient: mod + prof", () => expect(skillBonus(14, "proficient", 2)).toBe(4));
  it("expertise: mod + 2*prof", () => expect(skillBonus(14, "expertise", 2)).toBe(6));
  it("negative mod with expertise", () => expect(skillBonus(8, "expertise", 3)).toBe(5));
});

describe("passivePerception", () => {
  it("WIS 8, none, prof 2 -> 9", () => expect(passivePerception(8, "none", 2)).toBe(9));
  it("WIS 14, proficient, prof 2 -> 14", () => expect(passivePerception(14, "proficient", 2)).toBe(14));
  it("WIS 10, expertise, prof 3 -> 16", () => expect(passivePerception(10, "expertise", 3)).toBe(16));
});

describe("attackBonus", () => {
  it("DEX 14, prof 2 -> +4", () => expect(attackBonus(14, 2)).toBe(4));
  it("STR 8, prof 2 -> +1", () => expect(attackBonus(8, 2)).toBe(1));
  it("STR 27, prof 7 -> +15", () => expect(attackBonus(27, 7)).toBe(15));
});

describe("saveDC", () => {
  it("WIS 8, prof 2 -> 9", () => expect(saveDC(8, 2)).toBe(9));
  it("CON 25, prof 7 -> 22", () => expect(saveDC(25, 7)).toBe(22));
  it("CHA 19, prof 7 -> 19", () => expect(saveDC(19, 7)).toBe(19));
});

describe("abilityNameToKey", () => {
  it("STR -> str", () => expect(abilityNameToKey("STR")).toBe("str"));
  it("dex -> dex", () => expect(abilityNameToKey("dex")).toBe("dex"));
  it("Wisdom -> null", () => expect(abilityNameToKey("Wisdom")).toBeNull());
  it("FOO -> null", () => expect(abilityNameToKey("FOO")).toBeNull());
});
