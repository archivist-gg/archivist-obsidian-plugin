import { describe, it, expect } from "vitest";
import { enrichMonster } from "../src/modules/monster/monster.enrichment";
import { enrichSpell } from "../src/modules/spell/spell.enrichment";
import { enrichItem } from "../src/modules/item/item.enrichment";

describe("enrichMonster — backtick tag conversion", () => {
  it("converts plain English attack and damage to ability-linked tags", () => {
    // STR 16 → mod +3, CR 1 → prof +2, so atk = +5, mod = 3
    const raw: Record<string, unknown> = {
      name: "Test Brute",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Greataxe",
          entries: [
            "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toContain("`atk:STR`");
    expect(entry).toContain("`damage:1d12+STR`");
    expect(entry).not.toContain("+5 to hit");
    expect(entry).not.toContain("9 (1d12 + 3)");
  });

  it("leaves already-tagged entries unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Test Brute",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Greataxe",
          entries: [
            "Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. Hit: `damage:1d12+STR` slashing damage.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toBe(
      "Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. Hit: `damage:1d12+STR` slashing damage.",
    );
  });

  it("passes 5etools tags through unchanged (handled at render time)", () => {
    const raw: Record<string, unknown> = {
      name: "Test",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Slash",
          entries: [
            "Melee Weapon Attack: {@hit 5} to hit, reach 5 ft., one target. {@h} {@damage 1d12+3} slashing damage.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toContain("{@hit 5}");
    expect(entry).toContain("{@damage 1d12+3}");
  });

  it("converts DC with explicit ability word", () => {
    // CON 14 → mod +2, CR 1 → prof +2, DC = 8 + 2 + 2 = 12
    const raw: Record<string, unknown> = {
      name: "Test",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      traits: [
        {
          name: "Poison Aura",
          entries: [
            "Each creature must succeed on a DC 12 Constitution saving throw or be poisoned.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.traits as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toContain("`dc:CON`");
    expect(entry).not.toContain("DC 12");
  });

  it("converts entries across multiple sections", () => {
    // STR 16 → mod +3, CR 1 → prof +2
    const raw: Record<string, unknown> = {
      name: "Multi-Section Monster",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Claw",
          entries: ["Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage."],
        },
      ],
      reactions: [
        {
          name: "Parry",
          entries: ["The creature adds 2 to its AC against one melee attack. The attacker takes 3 (1d6) slashing damage."],
        },
      ],
    };
    const result = enrichMonster(raw);
    const actionEntry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    const reactionEntry = (result.reactions as { name: string; entries: string[] }[])[0].entries[0];
    expect(actionEntry).toContain("`atk:STR`");
    expect(actionEntry).toContain("`damage:1d6+STR`");
    expect(reactionEntry).toContain("`damage:1d6`");
  });

  it("does not crash when monster has no feature sections", () => {
    const raw: Record<string, unknown> = {
      name: "Blob",
      cr: "0",
      abilities: { str: 3, dex: 6, con: 10, int: 1, wis: 6, cha: 1 },
    };
    const result = enrichMonster(raw);
    expect(result.name).toBe("Blob");
  });
});

describe("enrichSpell — backtick tag conversion", () => {
  it("converts static DC and damage dice in description", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Burst",
      level: 3,
      description: [
        "Each creature in the area must make a DC 15 Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much on a success.",
      ],
    };
    const result = enrichSpell(raw);
    const desc = (result.description as string[])[0];
    expect(desc).toContain("`dc:15`");
    expect(desc).toContain("`damage:8d6`");
  });

  it("leaves already-tagged description unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Burst",
      level: 3,
      description: [
        "Each creature must make a `dc:15` Dexterity saving throw, taking `damage:8d6` fire damage on a failed save.",
      ],
    };
    const result = enrichSpell(raw);
    const desc = (result.description as string[])[0];
    expect(desc).toBe(
      "Each creature must make a `dc:15` Dexterity saving throw, taking `damage:8d6` fire damage on a failed save.",
    );
  });

  it("converts bare dice in at_higher_levels", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Burst",
      level: 3,
      at_higher_levels: [
        "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
      ],
    };
    const result = enrichSpell(raw);
    const higher = (result.at_higher_levels as string[])[0];
    expect(higher).toContain("`dice:1d6`");
  });

  it("leaves plain text without mechanics unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Detect Magic",
      level: 1,
      description: [
        "For the duration, you sense the presence of magic within 30 feet of you.",
      ],
    };
    const result = enrichSpell(raw);
    const desc = (result.description as string[])[0];
    expect(desc).toBe("For the duration, you sense the presence of magic within 30 feet of you.");
  });
});

describe("enrichItem — backtick tag conversion", () => {
  it("converts bare damage dice in entries", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Tongue",
      type: "Weapon (any sword)",
      rarity: "Rare",
      entries: [
        "While the sword is ablaze, it deals an extra 2d6 fire damage to any target it hits.",
      ],
    };
    const result = enrichItem(raw);
    const entry = (result.entries as string[])[0];
    expect(entry).toContain("`damage:2d6`");
  });

  it("leaves already-tagged entries unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Tongue",
      type: "Weapon (any sword)",
      rarity: "Rare",
      entries: [
        "While the sword is ablaze, it deals an extra `damage:2d6` fire damage to any target it hits.",
      ],
    };
    const result = enrichItem(raw);
    const entry = (result.entries as string[])[0];
    expect(entry).toBe(
      "While the sword is ablaze, it deals an extra `damage:2d6` fire damage to any target it hits.",
    );
  });

  it("leaves plain text entries unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Bag of Holding",
      type: "Wondrous item",
      rarity: "Uncommon",
      entries: [
        "This bag has an interior space considerably larger than its outside dimensions.",
      ],
    };
    const result = enrichItem(raw);
    const entry = (result.entries as string[])[0];
    expect(entry).toBe(
      "This bag has an interior space considerably larger than its outside dimensions.",
    );
  });

  it("does not crash when item has no entries", () => {
    const raw: Record<string, unknown> = {
      name: "Simple Ring",
      type: "Ring",
      rarity: "Common",
    };
    const result = enrichItem(raw);
    expect(result.name).toBe("Simple Ring");
  });
});
