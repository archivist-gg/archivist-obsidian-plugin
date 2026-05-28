// tests/pc-proficiency-query.test.ts

import { describe, it, expect } from "vitest";
import { isProficientWithWeapon, isProficientWithArmor } from "../src/modules/pc/pc.proficiency-query";
import type { ArmorEntity } from "../src/modules/armor/armor.types";
import type { WeaponEntity } from "../src/modules/weapon/weapon.types";

const longsword: WeaponEntity = {
  name: "Longsword", slug: "longsword", edition: "2014", category: "martial-melee",
  damage: { dice: "1d8", type: "slashing" }, properties: [],
};
const shortsword: WeaponEntity = {
  name: "Shortsword", slug: "shortsword", edition: "2014", category: "martial-melee",
  damage: { dice: "1d6", type: "piercing" }, properties: ["finesse", "light"],
};

const plate: ArmorEntity = {
  name: "Plate", slug: "plate", category: "heavy",
  ac: { base: 18, flat: 0, add_dex: false, add_con: false, add_wis: false },
};
const breastplate: ArmorEntity = {
  name: "Breastplate", slug: "breastplate", category: "medium",
  ac: { base: 14, flat: 0, add_dex: true, dex_max: 2, add_con: false, add_wis: false },
};
const leather: ArmorEntity = {
  name: "Leather", slug: "leather", category: "light",
  ac: { base: 11, flat: 0, add_dex: true, add_con: false, add_wis: false },
};

const emptyProfs = (overrides: Partial<{ armor: { categories: string[]; specific: string[] }; weapons: { categories: string[]; specific: string[] } }>) => ({
  armor: { categories: [], specific: [] },
  weapons: { categories: [], specific: [] },
  tools: { categories: [], specific: [] },
  ...overrides,
});

describe("isProficientWithWeapon", () => {
  it("returns true for category match", () => {
    expect(isProficientWithWeapon(longsword, emptyProfs({ weapons: { categories: ["martial"], specific: [] } }))).toBe(true);
  });

  it("returns true for specific slug match", () => {
    expect(isProficientWithWeapon(longsword, emptyProfs({ weapons: { categories: [], specific: ["longsword"] } }))).toBe(true);
  });

  it("returns false when no category or slug matches", () => {
    const profs = emptyProfs({ weapons: { categories: ["simple"], specific: [] } });
    expect(isProficientWithWeapon(longsword, profs)).toBe(false);
    expect(isProficientWithWeapon(shortsword, profs)).toBe(false);
  });
});

describe("isProficientWithArmor", () => {
  it("category match", () => {
    expect(isProficientWithArmor(plate, emptyProfs({ armor: { categories: ["heavy"], specific: [] } }))).toBe(true);
  });

  it("heavy proficiency implies medium and light", () => {
    const profs = emptyProfs({ armor: { categories: ["heavy"], specific: [] } });
    expect(isProficientWithArmor(breastplate, profs)).toBe(true);
    expect(isProficientWithArmor(leather, profs)).toBe(true);
  });

  it("medium proficiency implies light only", () => {
    const profs = emptyProfs({ armor: { categories: ["medium"], specific: [] } });
    expect(isProficientWithArmor(leather, profs)).toBe(true);
    expect(isProficientWithArmor(plate, profs)).toBe(false);
  });

  it("light proficiency does not imply medium or heavy", () => {
    const profs = emptyProfs({ armor: { categories: ["light"], specific: [] } });
    expect(isProficientWithArmor(breastplate, profs)).toBe(false);
    expect(isProficientWithArmor(plate, profs)).toBe(false);
  });

  it("specific slug match (e.g., shield)", () => {
    const shield: ArmorEntity = {
      name: "Shield", slug: "shield", category: "shield",
      ac: { base: 0, flat: 2, add_dex: false, add_con: false, add_wis: false },
    };
    expect(isProficientWithArmor(shield, emptyProfs({ armor: { categories: [], specific: ["shield"] } }))).toBe(true);
  });
});
