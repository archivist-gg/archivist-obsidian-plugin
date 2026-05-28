// tests/srd-tag-converter.test.ts
import { describe, it, expect } from "vitest";
import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ConversionContext,
} from "../src/shared/dnd/srd-tag-converter";

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

  it("replaces '+14 to hit' with literal atk:+14 when no damage clause is present", () => {
    const input = "Melee Weapon Attack: +14 to hit, reach 10 ft.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Melee Weapon Attack: `atk:+14`, reach 10 ft.",
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

  it("falls back to literal when no damage clause is present (no disambiguation possible)", () => {
    // Balanced monster: STR 14 (+2), DEX 14 (+2), prof +2, both → +4
    const balanced: ConversionContext = {
      abilities: { str: 14, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      profBonus: 2,
      actionName: "Scimitar",
      actionCategory: "action",
    };
    const input = "Melee Weapon Attack: +4 to hit";
    expect(convertDescToTags(input, balanced)).toBe(
      "Melee Weapon Attack: `atk:+4`",
    );
  });

  it("falls back to literal for Ranged Weapon Attack with no damage", () => {
    const balanced: ConversionContext = {
      abilities: { str: 14, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      profBonus: 2,
      actionName: "Shortbow",
      actionCategory: "action",
    };
    const input = "Ranged Weapon Attack: +4 to hit";
    expect(convertDescToTags(input, balanced)).toBe(
      "Ranged Weapon Attack: `atk:+4`",
    );
  });
});

describe("convertDescToTags — Pass 3: Damage expressions", () => {
  // STR 27 (+8), prof +6
  const CTX: ConversionContext = {
    abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
    profBonus: 6,
    actionName: "Bite",
    actionCategory: "action",
  };

  it("converts '21 (3d8 + 8) slashing damage' with STR mod match", () => {
    // STR mod = 8, so +8 matches STR
    const input = "Hit: 21 (3d8 + 8) slashing damage.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Hit: `dmg:3d8+STR` slashing damage.",
    );
  });

  it("strips the average parenthetical when no bonus is present", () => {
    // No ability mod logic triggers, but the avg '(3d8)' still gets stripped
    const input = "Hit: 13 (3d8) lightning damage.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Hit: `dmg:3d8` lightning damage.",
    );
  });

  it("emits static damage bonus when it does not match any ability mod", () => {
    // +4 doesn't match any of the dragon's mods (8, 0, 7, 3, 1, 5)
    const input = "Hit: 11 (2d6 + 4) fire damage.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Hit: `dmg:2d6+4` fire damage.",
    );
  });

  it("handles dice without bonus or average", () => {
    const input = "Takes 1d4 acid damage.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Takes `dmg:1d4` acid damage.",
    );
  });

  it("handles multiple damage clauses in one sentence", () => {
    const input =
      "Hit: 21 (3d8 + 8) slashing damage plus 13 (3d8) lightning damage.";
    expect(convertDescToTags(input, CTX)).toBe(
      "Hit: `dmg:3d8+STR` slashing damage plus `dmg:3d8` lightning damage.",
    );
  });
});

describe("convertDescToTags — Pass 4: Bare dice + DC fallback", () => {
  const CTX: ConversionContext = {
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    profBonus: 2,
    actionName: "Sacred Flame",
    actionCategory: "action",
    spellAbility: "wis",
  };

  it("wraps bare dice left over from earlier passes", () => {
    // 1d8 has no trailing "damage" word so Pass 3 doesn't match it
    const input = "roll 1d8 and add your Wisdom modifier";
    expect(convertDescToTags(input, CTX)).toBe(
      "roll `dice:1d8` and add your Wisdom modifier",
    );
  });

  it("handles a DC without an ability word using spellAbility", () => {
    // saveDC(wis 14) = 8 + 2 + 2 = 12
    const input = "spell save DC 12";
    expect(convertDescToTags(input, CTX)).toBe(
      "spell save `dc:WIS`",
    );
  });

  it("emits static dc:N when no ability matches and no spellAbility hint", () => {
    const noSpellCtx: ConversionContext = { ...CTX, spellAbility: undefined };
    const input = "DC 99";
    expect(convertDescToTags(input, noSpellCtx)).toBe("`dc:99`");
  });

  it("is idempotent: running twice produces the same output", () => {
    const input = "Melee Weapon Attack: +14 to hit, 21 (3d8 + 8) slashing damage.";
    const dragon: ConversionContext = {
      abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
      profBonus: 6,
      actionName: "Bite",
      actionCategory: "action",
    };
    const once = convertDescToTags(input, dragon);
    const twice = convertDescToTags(once, dragon);
    expect(twice).toBe(once);
  });
});

describe("convertDescToTags — real SRD regressions", () => {
  // Goblin: STR 8 (-1), DEX 14 (+2), prof +2 (CR 1/4)
  // atkTargets: str=+1, dex=+4; mods.str=-1, mods.dex=+2
  const GOBLIN: ConversionContext = {
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    profBonus: 2,
    actionName: "Scimitar",
    actionCategory: "action",
  };

  it("Goblin Scimitar", () => {
    const input =
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.";
    expect(convertDescToTags(input, GOBLIN)).toBe(
      "Melee Weapon Attack: `atk:DEX+PB`, reach 5 ft., one target. Hit: `dmg:1d6+DEX` slashing damage.",
    );
  });

  // Wolf: STR 12 (+1), DEX 15 (+2), prof +2 (CR 1/4)
  // atkTargets: str=+3, dex=+4
  const WOLF: ConversionContext = {
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    profBonus: 2,
    actionName: "Bite",
    actionCategory: "action",
  };

  it("Wolf Bite with knockdown DC", () => {
    const input =
      "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.";
    // saveDC(str 12) = 8 + 2 + 1 = 11 → matches
    // atk +4: str=+3 no, dex=+4 yes → DEX (melee keyword makes no difference, single candidate)
    // damage +2: matches DEX mod → DEX
    expect(convertDescToTags(input, WOLF)).toBe(
      "Melee Weapon Attack: `atk:DEX+PB`, reach 5 ft., one target. Hit: `dmg:2d4+DEX` piercing damage. If the target is a creature, it must succeed on a `dc:STR` Strength saving throw or be knocked prone.",
    );
  });

  // Acolyte spellcaster: INT 10 (+0), WIS 14 (+2), CHA 11 (+0), prof +2
  // saveDC(wis) = 8 + 2 + 2 = 12; atkBonus(wis) = +2 + 2 = +4
  const ACOLYTE: ConversionContext = {
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 11 },
    profBonus: 2,
    actionName: "Spellcasting",
    actionCategory: "trait",
    spellAbility: "wis",
  };

  it("Acolyte spellcasting description", () => {
    const input =
      "The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks).";
    const result = convertDescToTags(input, ACOLYTE);
    expect(result).toContain("`dc:WIS`");
    expect(result).toContain("`atk:+4`");
  });
});

describe("convertDescToTags — damage-driven attribution (Phase 0.5)", () => {
  const KNIGHT_CTX: ConversionContext = {
    abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
    profBonus: 2,
    actionName: "Greatsword",
    actionCategory: "action",
  };

  const GHOUL_CTX: ConversionContext = {
    abilities: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    profBonus: 2,
    actionName: "Bite",
    actionCategory: "action",
  };

  const CAT_CTX: ConversionContext = {
    abilities: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
    profBonus: 2,
    actionName: "Claws",
    actionCategory: "action",
  };

  it("Knight Greatsword (+5, 2d6+3): emits atk:STR+PB and dmg:2d6+STR", () => {
    const desc = "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.";
    const result = convertDescToTags(desc, KNIGHT_CTX);
    expect(result).toContain("`atk:STR+PB`");
    expect(result).toContain("`dmg:2d6+STR`");
  });

  it("Ghoul Bite (+2, 2d6+2): emits atk:DEX (non-proficient) and dmg:2d6+DEX", () => {
    const desc = "Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 9 (2d6 + 2) piercing damage.";
    const result = convertDescToTags(desc, GHOUL_CTX);
    expect(result).toContain("`atk:DEX`");
    expect(result).toContain("`dmg:2d6+DEX`");
  });

  it("Ghoul Claws (+4, 2d4+2): emits atk:DEX+PB and dmg:2d4+DEX", () => {
    const desc = "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) slashing damage.";
    const ctx = { ...GHOUL_CTX, actionName: "Claws" };
    const result = convertDescToTags(desc, ctx);
    expect(result).toContain("`atk:DEX+PB`");
    expect(result).toContain("`dmg:2d4+DEX`");
  });

  it("Cat Claws (+0, flat 1 slashing): emits atk:+0 and dmg:1", () => {
    const desc = "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 slashing damage.";
    const result = convertDescToTags(desc, CAT_CTX);
    expect(result).toContain("`atk:+0`");
    expect(result).toContain("`dmg:1`");
  });

  it("running on already-converted text is stable", () => {
    const original = "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.";
    const once = convertDescToTags(original, KNIGHT_CTX);
    const twice = convertDescToTags(once, KNIGHT_CTX);
    expect(twice).toBe(once);
  });
});

describe("convertDescToTags — 2024 prose forms", () => {
  // Adult Black Dragon (2024): STR 23 (+6), DEX 14 (+2), CON 21 (+5), INT 14 (+2), WIS 13 (+1), CHA 19 (+4); CR 14 → PB 5.
  // atkTargets: str=+11, dex=+7
  // dcTargets:  str=8+5+6=19, dex=8+5+2=15, con=8+5+5=18, int=15, wis=14, cha=17
  const DRAGON_2024: ConversionContext = {
    abilities: { str: 23, dex: 14, con: 21, int: 14, wis: 13, cha: 19 },
    profBonus: 5,
    actionName: "Rend",
    actionCategory: "action",
  };

  it("converts 2024 'Melee Attack Roll: +N' to atk:STR+PB when STR matches", () => {
    // STR mod +6 + PB 5 = +11 → atk:STR+PB
    const result = convertDescToTags(
      "Melee Attack Roll: +11, reach 10 ft. 13 (2d6 + 6) Slashing damage.",
      { ...DRAGON_2024, actionName: "Rend" },
    );
    expect(result).toContain("`atk:STR+PB`");
    expect(result).toContain("`dmg:2d6+STR`");
  });

  it("converts 2024 'Ranged Attack Roll: +N'", () => {
    // For a ranged shot — DEX mod +2 + PB 5 = +7 → atk:DEX+PB
    const result = convertDescToTags(
      "Ranged Attack Roll: +7, range 80/320 ft. 7 (1d8 + 2) Piercing damage.",
      { ...DRAGON_2024, actionName: "Longbow" },
    );
    expect(result).toContain("`atk:DEX+PB`");
    expect(result).toContain("`dmg:1d8+DEX`");
  });

  it("respects explicit ability word in 2024 'Dexterity Saving Throw: DC N'", () => {
    // DC 18: matches CON (8+5+5=18). Pass 1b would mistakenly pick CON.
    // Pass 0 must see "Dexterity" and emit dc:N literal (DEX target is 15, not 18).
    const result = convertDescToTags(
      "Dexterity Saving Throw: DC 18, each creature in a 60-foot-long, 5-foot-wide Line. Failure: 54 (12d8) Acid damage.",
      { ...DRAGON_2024, actionName: "Acid Breath" },
    );
    expect(result).not.toContain("`dc:CON`");
    const hasDcDex = result.includes("`dc:DEX`");
    const hasDcLiteral = result.includes("`dc:18`");
    expect(hasDcDex || hasDcLiteral).toBe(true);
  });

  it("emits dc:ABIL when 2024 explicit ability matches its computed target", () => {
    // STR target = 19, prose says "Strength" with DC 19 → emit dc:STR
    const result = convertDescToTags(
      "Strength Saving Throw: DC 19, each creature in a 15-foot Cone.",
      DRAGON_2024,
    );
    expect(result).toContain("`dc:STR`");
  });

  it("idempotent on 2024 prose", () => {
    const desc = "Melee Attack Roll: +11, reach 10 ft. 13 (2d6 + 6) Slashing damage. Dexterity Saving Throw: DC 18.";
    const once = convertDescToTags(desc, DRAGON_2024);
    const twice = convertDescToTags(once, DRAGON_2024);
    expect(twice).toBe(once);
  });

  it("idempotent: running twice produces same output as once (2014 form)", () => {
    const ctx: ConversionContext = {
      abilities: { str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 },
      profBonus: 4,
      actionName: "Tail",
      actionCategory: "action",
    };
    const desc = "Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 15 (3d6 + 5) bludgeoning damage.";
    const once = convertDescToTags(desc, ctx);
    const twice = convertDescToTags(once, ctx);
    expect(twice).toBe(once);
  });
});
