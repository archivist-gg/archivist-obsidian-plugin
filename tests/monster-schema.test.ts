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
});
