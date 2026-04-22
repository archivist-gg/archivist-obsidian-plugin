import { describe, it, expect } from "vitest";
import { itemInputSchema } from "../src/modules/item/item.ai-schema";

describe("itemInputSchema", () => {
  it("validates a valid item", () => {
    const result = itemInputSchema.safeParse({
      name: "Flame Tongue", type: "weapon", rarity: "rare", attunement: true,
      entries: ["When you attack with this magic sword..."],
    });
    expect(result.success).toBe(true);
  });
  it("rejects invalid rarity", () => {
    const result = itemInputSchema.safeParse({ name: "Test", type: "weapon", rarity: "mythic" });
    expect(result.success).toBe(false);
  });
  it("accepts string attunement", () => {
    const result = itemInputSchema.safeParse({
      name: "Test", type: "wondrous item", rarity: "rare", attunement: "by a spellcaster",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.attunement).toBe("by a spellcaster");
  });

  it("accepts entries with inline damage formula tags", () => {
    const result = itemInputSchema.safeParse({
      name: "Flame Tongue", type: "weapon", rarity: "rare", attunement: true,
      entries: [
        "While the sword is ablaze, it deals an extra `damage:2d6` fire damage to any target it hits.",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts entries with attack and damage formula tags", () => {
    const result = itemInputSchema.safeParse({
      name: "Staff of Striking", type: "staff", rarity: "very rare", attunement: true,
      charges: 10, recharge: "1d6 + 4 at dawn",
      entries: [
        "This staff has 10 charges. When you hit with a melee attack using it, you can expend up to 3 charges. For each charge you expend, the target takes an extra `damage:1d6` force damage.",
        "Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. Hit: `damage:1d6+STR` bludgeoning damage.",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts entries with save DC formula tags", () => {
    const result = itemInputSchema.safeParse({
      name: "Wand of Fireballs", type: "wand", rarity: "rare", attunement: "by a spellcaster",
      charges: 7, recharge: "1d6 + 1 at dawn",
      entries: [
        "Each creature in a 20-foot-radius sphere must make a `dc:CHA` Dexterity saving throw, taking `damage:8d6` fire damage on a failed save, or half as much on a success.",
      ],
    });
    expect(result.success).toBe(true);
  });
});
