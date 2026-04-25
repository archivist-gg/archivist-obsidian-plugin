import { EntityRegistry } from "../../../src/shared/entities/entity-registry";
import { buildMockRegistry } from "./mock-entity-registry";
import type { ArmorEntity } from "../../../src/modules/armor/armor.types";
import type { WeaponEntity } from "../../../src/modules/weapon/weapon.types";
import type { ItemEntity } from "../../../src/modules/item/item.types";

export const PLATE: ArmorEntity = {
  name: "Plate",
  slug: "plate",
  category: "heavy",
  ac: { base: 18, flat: 0, add_dex: false, add_con: false, add_wis: false },
  strength_requirement: 15,
  stealth_disadvantage: true,
};

export const STUDDED_LEATHER: ArmorEntity = {
  name: "Studded Leather",
  slug: "studded-leather",
  category: "light",
  ac: { base: 12, flat: 0, add_dex: true, add_con: false, add_wis: false },
};

export const BREASTPLATE: ArmorEntity = {
  name: "Breastplate",
  slug: "breastplate",
  category: "medium",
  ac: { base: 14, flat: 0, add_dex: true, dex_max: 2, add_con: false, add_wis: false },
};

export const SHIELD: ArmorEntity = {
  name: "Shield",
  slug: "shield",
  category: "shield",
  ac: { base: 0, flat: 2, add_dex: false, add_con: false, add_wis: false },
};

export const LONGSWORD: WeaponEntity = {
  name: "Longsword",
  slug: "longsword",
  category: "martial-melee",
  damage: { dice: "1d8", type: "slashing", versatile_dice: "1d10" },
  properties: ["versatile"],
};

export const SHORTSWORD: WeaponEntity = {
  name: "Shortsword",
  slug: "shortsword",
  category: "martial-melee",
  damage: { dice: "1d6", type: "piercing" },
  properties: ["finesse", "light"],
};

export const RAPIER: WeaponEntity = {
  name: "Rapier",
  slug: "rapier",
  category: "martial-melee",
  damage: { dice: "1d8", type: "piercing" },
  properties: ["finesse"],
};

export const SHORTBOW: WeaponEntity = {
  name: "Shortbow",
  slug: "shortbow",
  category: "simple-ranged",
  damage: { dice: "1d6", type: "piercing" },
  properties: ["ammunition", "two_handed"],
  range: { normal: 80, long: 320 },
};

export const GREATSWORD: WeaponEntity = {
  name: "Greatsword",
  slug: "greatsword",
  category: "martial-melee",
  damage: { dice: "2d6", type: "slashing" },
  properties: ["heavy", "two_handed"],
};

export const CLOAK_OF_PROTECTION: ItemEntity = {
  name: "Cloak of Protection",
  slug: "cloak-of-protection",
  type: "wondrous",
  rarity: "uncommon",
  bonuses: { ac: 1, saving_throws: 1 },
  attunement: { required: true },
};

export const FLAME_TONGUE: ItemEntity = {
  name: "Flame Tongue",
  slug: "flame-tongue",
  type: "weapon",
  rarity: "rare",
  base_item: "longsword",
  bonuses: { weapon_attack: 0, weapon_damage: 0 },
  attunement: { required: true },
};

export const PLUS_ONE_LONGSWORD: ItemEntity = {
  name: "+1 Longsword",
  slug: "plus-one-longsword",
  type: "weapon",
  rarity: "uncommon",
  base_item: "longsword",
  bonuses: { weapon_attack: 1, weapon_damage: 1 },
  attunement: false,
};

export const BELT_OF_HILL_GIANT_STRENGTH: ItemEntity = {
  name: "Belt of Hill Giant Strength",
  slug: "belt-of-hill-giant-strength",
  type: "wondrous",
  rarity: "rare",
  bonuses: { ability_scores: { static: { str: 21 } } },
  attunement: { required: true },
};

export const HEADBAND_OF_INTELLECT: ItemEntity = {
  name: "Headband of Intellect",
  slug: "headband-of-intellect",
  type: "wondrous",
  rarity: "uncommon",
  bonuses: { ability_scores: { static: { int: 19 } } },
  attunement: { required: true },
};

export const WAND_OF_FIREBALLS: ItemEntity = {
  name: "Wand of Fireballs",
  slug: "wand-of-fireballs",
  type: "wand",
  rarity: "rare",
  charges: { max: 7, recharge: "dawn", recharge_amount: "1d6+1" },
  attunement: { required: true },
};

export function buildEquipmentRegistry(): EntityRegistry {
  return buildMockRegistry([
    { slug: "plate", entityType: "armor", name: "Plate", data: PLATE },
    { slug: "studded-leather", entityType: "armor", name: "Studded Leather", data: STUDDED_LEATHER },
    { slug: "breastplate", entityType: "armor", name: "Breastplate", data: BREASTPLATE },
    { slug: "shield", entityType: "armor", name: "Shield", data: SHIELD },
    { slug: "longsword", entityType: "weapon", name: "Longsword", data: LONGSWORD },
    { slug: "shortsword", entityType: "weapon", name: "Shortsword", data: SHORTSWORD },
    { slug: "rapier", entityType: "weapon", name: "Rapier", data: RAPIER },
    { slug: "shortbow", entityType: "weapon", name: "Shortbow", data: SHORTBOW },
    { slug: "greatsword", entityType: "weapon", name: "Greatsword", data: GREATSWORD },
    { slug: "cloak-of-protection", entityType: "item", name: "Cloak of Protection", data: CLOAK_OF_PROTECTION },
    { slug: "flame-tongue", entityType: "item", name: "Flame Tongue", data: FLAME_TONGUE },
    { slug: "plus-one-longsword", entityType: "item", name: "+1 Longsword", data: PLUS_ONE_LONGSWORD },
    {
      slug: "belt-of-hill-giant-strength",
      entityType: "item",
      name: "Belt of Hill Giant Strength",
      data: BELT_OF_HILL_GIANT_STRENGTH,
    },
    { slug: "headband-of-intellect", entityType: "item", name: "Headband of Intellect", data: HEADBAND_OF_INTELLECT },
    { slug: "wand-of-fireballs", entityType: "item", name: "Wand of Fireballs", data: WAND_OF_FIREBALLS },
  ]);
}
