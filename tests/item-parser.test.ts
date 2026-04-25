import { describe, it, expect } from "vitest";
import { parseItem } from "../src/modules/item/item.parser";

describe("parseItem", () => {
  it("parses a minimal item (name only)", () => {
    const result = parseItem("name: Bag of Holding");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bag of Holding");
    }
  });

  it("fails when name is missing", () => {
    const result = parseItem("rarity: Rare");
    expect(result.success).toBe(false);
  });

  it("parses a full magic item", () => {
    const yaml = `
name: Flame Tongue Longsword
type: Weapon (longsword)
rarity: Rare
attunement: true
weight: 3
damage: 1d8
damage_type: slashing
properties: [Versatile (1d10)]
entries:
  - "You can use a bonus action to speak this magic sword's command word."
`;
    const result = parseItem(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      const i = result.data;
      expect(i.name).toBe("Flame Tongue Longsword");
      expect(i.rarity).toBe("Rare");
      expect(i.attunement).toEqual({ required: true });
      expect(i.weight).toBe(3);
      expect(i.properties).toEqual(["Versatile (1d10)"]);
      expect(i.entries?.length).toBe(1);
    }
  });

  it("parses attunement as string", () => {
    const result = parseItem("name: Test\nattunement: by a warlock");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attunement).toEqual({ required: true, restriction: "by a warlock" });
    }
  });
});
