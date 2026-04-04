import { describe, it, expect } from "vitest";
import { monsterInputSchema } from "../src/ai/schemas/monster-schema";

describe("monsterInputSchema", () => {
  it("validates a minimal monster", () => {
    const result = monsterInputSchema.safeParse({
      name: "Goblin", size: "Small", type: "Humanoid", alignment: "Neutral Evil",
      cr: "1/4", abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      ac: [{ ac: 15 }], hp: { average: 7, formula: "2d6" }, speed: { walk: 30 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = monsterInputSchema.safeParse({
      size: "Small", type: "Humanoid", alignment: "Neutral Evil", cr: "1",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ac: [{ ac: 10 }], hp: { average: 10, formula: "2d8+2" }, speed: { walk: 30 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects ability scores outside 1-30", () => {
    const result = monsterInputSchema.safeParse({
      name: "Test", size: "Medium", type: "Beast", alignment: "Unaligned", cr: "1",
      abilities: { str: 0, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ac: [{ ac: 10 }], hp: { average: 10, formula: "2d8+2" }, speed: { walk: 30 },
    });
    expect(result.success).toBe(false);
  });

  it("validates a full monster with all optional fields", () => {
    const result = monsterInputSchema.safeParse({
      name: "Adult Red Dragon", size: "Huge", type: "Dragon", alignment: "Chaotic Evil",
      cr: "17", abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
      ac: [{ ac: 19, from: ["natural armor"] }], hp: { average: 256, formula: "19d12+133" },
      speed: { walk: 40, fly: 80, climb: 40 },
      saves: { dex: 6, con: 13, wis: 7, cha: 11 },
      skills: { Perception: 13, Stealth: 6 },
      damage_immunities: ["fire"],
      senses: ["blindsight 60 ft.", "darkvision 120 ft."],
      passive_perception: 23, languages: ["Common", "Draconic"],
      traits: [{ name: "Legendary Resistance (3/Day)", entries: ["If the dragon fails a saving throw, it can choose to succeed instead."] }],
      actions: [{ name: "Multiattack", entries: ["The dragon makes three attacks."] }],
      legendary: [{ name: "Detect", entries: ["The dragon makes a Wisdom (Perception) check."] }],
      legendary_actions: 3, legendary_resistance: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts entries with inline formula tags for attacks and damage", () => {
    const result = monsterInputSchema.safeParse({
      name: "Goblin", size: "Small", type: "Humanoid", alignment: "Neutral Evil",
      cr: "1/4", abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      ac: [{ ac: 15, from: ["leather armor", "shield"] }],
      hp: { average: 7, formula: "2d6" }, speed: { walk: 30 },
      actions: [{
        name: "Scimitar",
        entries: ["Melee Weapon Attack: `atk:DEX` to hit, reach 5 ft., one target. Hit: `damage:1d6+DEX` slashing damage."],
      }, {
        name: "Shortbow",
        entries: ["Ranged Weapon Attack: `atk:DEX` to hit, range 80/320 ft., one target. Hit: `damage:1d6+DEX` piercing damage."],
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts entries with save DC formula tags", () => {
    const result = monsterInputSchema.safeParse({
      name: "Fire Elemental", size: "Large", type: "Elemental", alignment: "Neutral",
      cr: "5", abilities: { str: 10, dex: 17, con: 16, int: 6, wis: 10, cha: 7 },
      ac: [{ ac: 13 }], hp: { average: 102, formula: "12d10+36" }, speed: { walk: 50 },
      traits: [{
        name: "Fire Form",
        entries: ["A creature that touches the elemental or hits it with a melee attack while within 5 feet takes `damage:1d10` fire damage. A creature can also make a `dc:DEX` Dexterity saving throw."],
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts entries mixing formula tags and static text", () => {
    const result = monsterInputSchema.safeParse({
      name: "Orc", size: "Medium", type: "Humanoid", alignment: "Chaotic Evil",
      cr: "1/2", abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
      ac: [{ ac: 13, from: ["hide armor"] }], hp: { average: 15, formula: "2d8+6" },
      speed: { walk: 30 },
      actions: [{
        name: "Greataxe",
        entries: ["Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. Hit: `damage:1d12+STR` slashing damage."],
      }],
      reactions: [{
        name: "Aggressive",
        entries: ["As a bonus action, the orc can move up to its speed toward a hostile creature that it can see."],
      }],
    });
    expect(result.success).toBe(true);
  });
});
