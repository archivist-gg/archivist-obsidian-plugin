import { describe, it, expect } from "vitest";
import { expandVariants } from "../../tools/srd-canonical/expand-variants";

describe("expandVariants", () => {
  it("expands a +1 Weapon rule across all SRD base weapons", () => {
    const baseItems = [
      { name: "Longsword", slug: "longsword", base_item_type: "weapon" as const },
      { name: "Plate", slug: "plate", base_item_type: "armor" as const },
    ];
    const variants = [
      {
        name: "+1 Weapon",
        type: "GV",
        requires: [{ baseItem: "longsword|phb" }],
        inherits: { bonusWeapon: "+1", rarity: "uncommon", tier: "1" },
      },
    ];
    const result = expandVariants(baseItems, variants, "2014");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Longsword +1");
    expect(result[0].slug).toBe("longsword-1");
    expect(result[0].bonuses.attack).toBe(1);
  });

  it("matches by base_item_type when requires lists weapon=true", () => {
    const baseItems = [
      { name: "Longsword", slug: "longsword", base_item_type: "weapon" as const },
      { name: "Plate", slug: "plate", base_item_type: "armor" as const },
    ];
    const variants = [
      {
        name: "+1 Weapon",
        requires: [{ weapon: "true" }],
        inherits: { bonusWeapon: "+1" },
      },
    ];
    const result = expandVariants(baseItems, variants, "2014");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Longsword +1");
  });

  it("returns empty when variant requires baseItem that is not in base list", () => {
    const baseItems = [{ name: "Longsword", slug: "longsword", base_item_type: "weapon" as const }];
    const variants = [
      {
        name: "+1 Weapon",
        requires: [{ baseItem: "greatsword|phb" }],
        inherits: { bonusWeapon: "+1" },
      },
    ];
    const result = expandVariants(baseItems, variants, "2014");
    expect(result.length).toBe(0);
  });
});
