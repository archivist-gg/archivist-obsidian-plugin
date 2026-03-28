import { describe, it, expect } from "vitest";
import { itemInputSchema } from "../src/ai/schemas/item-schema";

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
});
