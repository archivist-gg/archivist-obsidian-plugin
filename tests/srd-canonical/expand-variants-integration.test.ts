import { describe, it, expect } from "vitest";
import { expandVariants, type BaseItem, type VariantRule } from "../../tools/srd-canonical/expand-variants";

describe("expand-variants integration shapes", () => {
  it("produces base_item wikilinks under the Weapons sub-folder", () => {
    const bases: BaseItem[] = [
      { name: "Longsword", slug: "longsword", base_item_type: "weapon", type: "M", sword: true, weaponCategory: "martial" },
    ];
    const variants: VariantRule[] = [
      {
        name: "+1 Weapon",
        type: "GV",
        requires: [{ weapon: "true" }],
        inherits: { bonusWeapon: "+1", rarity: "uncommon", tier: "1", namePrefix: "+1 " },
      },
    ];
    const out = expandVariants(bases, variants, "2014");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Longsword +1");
    expect(out[0].base_item).toBe("[[SRD 5e/Weapons/Longsword]]");
    expect(out[0].bonuses.attack).toBe(1);
    expect(out[0].rarity).toBe("uncommon");
  });

  it("produces base_item wikilinks under the Armor sub-folder", () => {
    const bases: BaseItem[] = [
      { name: "Plate", slug: "plate", base_item_type: "armor", type: "HA" },
    ];
    const variants: VariantRule[] = [
      {
        name: "+1 Armor",
        type: "GV",
        requires: [{ armor: "true" }],
        inherits: { bonusAc: "+1", rarity: "rare", namePrefix: "+1 " },
      },
    ];
    const out = expandVariants(bases, variants, "2014");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Plate +1");
    expect(out[0].base_item).toBe("[[SRD 5e/Armor/Plate]]");
    expect(out[0].bonuses.ac).toBe(1);
  });

  it("matches a sword-only variant against weapons flagged sword=true", () => {
    const bases: BaseItem[] = [
      { name: "Longsword", slug: "longsword", base_item_type: "weapon", sword: true },
      { name: "Greataxe", slug: "greataxe", base_item_type: "weapon", axe: true },
      { name: "Plate", slug: "plate", base_item_type: "armor" },
    ];
    const variants: VariantRule[] = [
      {
        name: "Frost Brand",
        type: "GV",
        requires: [{ sword: true }],
        inherits: { namePrefix: "Frost Brand ", rarity: "very rare", reqAttune: true },
      },
    ];
    const out = expandVariants(bases, variants, "2014");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Frost Brand Longsword");
    expect(out[0].base_item).toBe("[[SRD 5e/Weapons/Longsword]]");
    expect(out[0].rarity).toBe("very rare");
    expect(out[0].attunement.required).toBe(true);
  });

  it("matches a 5etools-style type code requirement (martial weapons)", () => {
    const bases: BaseItem[] = [
      { name: "Longsword", slug: "longsword", base_item_type: "weapon", type: "M", weaponCategory: "martial" },
      { name: "Dagger", slug: "dagger", base_item_type: "weapon", type: "M", weaponCategory: "simple" },
    ];
    const variants: VariantRule[] = [
      {
        name: "+1 Weapon (martial)",
        type: "GV",
        requires: [{ weaponCategory: "martial" }],
        inherits: { bonusWeapon: "+1", rarity: "uncommon", namePrefix: "+1 " },
      },
    ];
    const out = expandVariants(bases, variants, "2014");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Longsword +1");
  });

  it("matches a 2024-style name+source baseItem requirement", () => {
    const bases: BaseItem[] = [
      { name: "Longsword", slug: "longsword", base_item_type: "weapon" },
      { name: "Greatsword", slug: "greatsword", base_item_type: "weapon" },
    ];
    const variants: VariantRule[] = [
      {
        name: "Frost Brand",
        type: "GV",
        requires: [
          { name: "Greatsword", source: "XPHB" },
          { name: "Longsword", source: "XPHB" },
        ],
        inherits: { namePrefix: "Frost Brand ", rarity: "very rare" },
      },
    ];
    const out = expandVariants(bases, variants, "2024");
    expect(out).toHaveLength(2);
    expect(out.map(o => o.name).sort()).toEqual(["Frost Brand Greatsword", "Frost Brand Longsword"]);
    expect(out[0].base_item.startsWith("[[SRD 2024/Weapons/")).toBe(true);
  });
});
