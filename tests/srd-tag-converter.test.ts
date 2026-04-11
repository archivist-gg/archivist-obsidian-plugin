// tests/srd-tag-converter.test.ts
import { describe, it, expect } from "vitest";
import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ConversionContext,
} from "../src/entities/srd-tag-converter";

const DRAGON_CTX: ConversionContext = {
  abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
  profBonus: 6,
  actionName: "Bite",
  actionCategory: "action",
};

describe("convertDescToTags — skeleton", () => {
  it("returns the input unchanged when ctx has no meaningful patterns", () => {
    expect(convertDescToTags("plain prose", DRAGON_CTX)).toBe("plain prose");
  });
});

describe("detectSpellcastingAbility", () => {
  it("finds Wisdom in a spellcasting trait", () => {
    const traits = [
      {
        name: "Spellcasting",
        entries: [
          "The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12).",
        ],
      },
    ];
    expect(detectSpellcastingAbility(traits)).toBe("wis");
  });

  it("finds Intelligence", () => {
    const traits = [
      { name: "Spellcasting", entries: ["Its spellcasting ability is Intelligence."] },
    ];
    expect(detectSpellcastingAbility(traits)).toBe("int");
  });

  it("finds Charisma", () => {
    const traits = [
      { name: "Spellcasting", entries: ["Its spellcasting ability is Charisma."] },
    ];
    expect(detectSpellcastingAbility(traits)).toBe("cha");
  });

  it("returns undefined when there is no declaration", () => {
    const traits = [{ name: "Keen Smell", entries: ["has advantage on Perception"] }];
    expect(detectSpellcastingAbility(traits)).toBeUndefined();
  });

  it("returns undefined for undefined/empty traits", () => {
    expect(detectSpellcastingAbility(undefined)).toBeUndefined();
    expect(detectSpellcastingAbility([])).toBeUndefined();
  });
});
