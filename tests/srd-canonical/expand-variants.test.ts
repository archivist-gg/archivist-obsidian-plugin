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
    expect(result[0].bonuses?.weapon_attack).toBe(1);
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

describe("variant emits runtime bonus keys", () => {
  it("+1 longsword has bonuses.weapon_attack: 1, weapon_damage: 1", () => {
    const bases = [{ name: "Longsword", slug: "longsword", base_item_type: "weapon" as const, weapon: true }];
    const variants = [{
      name: "+1 Weapon",
      requires: [{ weapon: true }],
      inherits: { namePrefix: "+1 ", bonusWeapon: "+1", rarity: "uncommon", tier: "major" },
    }];
    const out = expandVariants(bases, variants, "2014");
    expect(out).toHaveLength(1);
    expect(out[0].bonuses).toEqual({ weapon_attack: 1, weapon_damage: 1 });
  });

  it("does not emit empty bonuses", () => {
    const bases = [{ name: "Longsword", slug: "longsword", base_item_type: "weapon" as const, weapon: true }];
    const variants = [{
      name: "Vicious Weapon",
      requires: [{ weapon: true }],
      inherits: { entries: ["Vicious effect"] },
    }];
    const out = expandVariants(bases, variants, "2014");
    expect(out).toHaveLength(1);
    expect(out[0].bonuses).toBeUndefined();
  });
});
