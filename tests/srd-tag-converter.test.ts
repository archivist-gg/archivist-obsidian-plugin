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

describe("convertDescToTags — Pass 1: DC with ability word", () => {
  // CR 17 dragon: CON 25 (+7), prof +6, saveDC(con) = 8 + 6 + 7 = 21
  const CTX: ConversionContext = {
    abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
    profBonus: 6,
    actionName: "Fire Breath",
    actionCategory: "action",
  };

  it("replaces 'DC 21 Dexterity' with dc:DEX when DEX matches", () => {
    // saveDC(dex 10) = 8 + 6 + 0 = 14 — does not match 21
    // saveDC(con 25) = 21 — but the ability word in the prose is DEX
    // Pass 1 trusts the literal ability word in the text
    const input = "must succeed on a DC 14 Dexterity saving throw";
    expect(convertDescToTags(input, CTX)).toBe(
      "must succeed on a `dc:DEX` Dexterity saving throw",
    );
  });

  it("emits static dc:N when the literal ability word does not match its target", () => {
    // DC 99 does not match any computed DC
    const input = "must succeed on a DC 99 Constitution saving throw";
    expect(convertDescToTags(input, CTX)).toBe(
      "must succeed on a `dc:99` Constitution saving throw",
    );
  });

  it("matches dc:CON for 'DC 21 Constitution saving throw'", () => {
    const input = "take 10d6 fire damage on a failed DC 21 Constitution saving throw";
    const result = convertDescToTags(input, CTX);
    expect(result).toContain("`dc:CON` Constitution saving throw");
  });

  it("is case-insensitive on the ability word", () => {
    const input = "DC 21 constitution saving throw";
    expect(convertDescToTags(input, CTX)).toContain("`dc:CON` constitution");
  });
});

describe("convertDescToTags — Pass 2: Attack bonus", () => {
  // Dragon: STR 27 (+8), DEX 10 (+0), prof +6
  // atkTargets: str=+14, dex=+6, con=..., int=..., wis=..., cha=...
  const CTX: ConversionContext = {
    abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
    profBonus: 6,
    actionName: "Bite",
    actionCategory: "action",
  };

  it("replaces '+14 to hit' with atk:STR when only STR matches", () => {
    const input = "Melee Weapon Attack: +14 to hit, reach 10 ft.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Melee Weapon Attack: `atk:STR`, reach 10 ft.",
    );
  });

  it("emits static atk:+N when no ability produces that bonus", () => {
    const input = "Melee Weapon Attack: +99 to hit";
    expect(convertDescToTags(input, CTX)).toBe(
      "Melee Weapon Attack: `atk:+99`",
    );
  });

  it("handles negative attack bonus as static", () => {
    const input = "Weapon Attack: -2 to hit";
    expect(convertDescToTags(input, CTX)).toBe(
      "Weapon Attack: `atk:-2`",
    );
  });

  it("disambiguates STR vs DEX in favor of STR for Melee Weapon Attack", () => {
    // Balanced monster: STR 14 (+2), DEX 14 (+2), prof +2, both → +4
    const balanced: ConversionContext = {
      abilities: { str: 14, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      profBonus: 2,
      actionName: "Scimitar",
      actionCategory: "action",
    };
    const input = "Melee Weapon Attack: +4 to hit";
    expect(convertDescToTags(input, balanced)).toBe(
      "Melee Weapon Attack: `atk:STR`",
    );
  });

  it("disambiguates STR vs DEX in favor of DEX for Ranged Weapon Attack", () => {
    const balanced: ConversionContext = {
      abilities: { str: 14, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      profBonus: 2,
      actionName: "Shortbow",
      actionCategory: "action",
    };
    const input = "Ranged Weapon Attack: +4 to hit";
    expect(convertDescToTags(input, balanced)).toBe(
      "Ranged Weapon Attack: `atk:DEX`",
    );
  });
});
