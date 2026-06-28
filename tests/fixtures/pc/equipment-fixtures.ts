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
  edition: "2014",
  category: "martial-melee",
  damage: { dice: "1d8", type: "slashing", versatile_dice: "1d10" },
  properties: ["versatile"],
};

export const CLUB: WeaponEntity = {
  name: "Club",
  slug: "club",
  edition: "2014",
  category: "simple-melee",
  damage: { dice: "1d4", type: "bludgeoning" },
  properties: ["light"],
};

export const SHORTSWORD: WeaponEntity = {
  name: "Shortsword",
  slug: "shortsword",
  edition: "2014",
  category: "martial-melee",
  damage: { dice: "1d6", type: "piercing" },
  properties: ["finesse", "light"],
};

export const RAPIER: WeaponEntity = {
  name: "Rapier",
  slug: "rapier",
  edition: "2014",
  category: "martial-melee",
  damage: { dice: "1d8", type: "piercing" },
  properties: ["finesse"],
};

export const SHORTBOW: WeaponEntity = {
  name: "Shortbow",
  slug: "shortbow",
  edition: "2014",
  category: "simple-ranged",
  damage: { dice: "1d6", type: "piercing" },
  properties: ["ammunition", "two_handed"],
  range: { normal: 80, long: 320 },
};

export const GREATSWORD: WeaponEntity = {
  name: "Greatsword",
  slug: "greatsword",
  edition: "2014",
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

export const SUN_BLADE: ItemEntity = {
  name: "Sun Blade",
  slug: "sun-blade",
  type: "weapon",
  rarity: "rare",
  base_item: "longsword",
  bonuses: { weapon_attack: 2, weapon_damage: 2 },
  attunement: { required: true },
  damage_type: "radiant",
  properties: ["finesse", "versatile"],
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

// Magic armor via base_item (mirrors SRD-2024 Adamantine Armor / +N breastplates).
export const ADAMANTINE_BREASTPLATE: ItemEntity = {
  name: "Adamantine Armor (Breastplate)",
  slug: "adamantine-breastplate",
  type: "armor",
  rarity: "uncommon",
  base_item: "breastplate",
  attunement: false,
};
export const BREASTPLATE_PLUS_3: ItemEntity = {
  name: "Breastplate (+3)",
  slug: "breastplate-3",
  type: "armor",
  rarity: "very rare",
  base_item: "breastplate",
  bonuses: { ac: 3 },
  attunement: false,
};
// SRD-2024-style shield whose category is "heavy", caught by name/slug not category.
export const HEAVY_SHIELD: ArmorEntity = {
  name: "Shield",
  slug: "heavy-shield",
  category: "heavy",
  ac: { base: 0, flat: 2, add_dex: false, add_con: false, add_wis: false },
};

// Item that grants a sense (darkvision 60) — folds into derived senses when
// equipped-and-active. No attunement required.
export const GOGGLES_OF_NIGHT: ItemEntity = {
  name: "Goggles of Night",
  slug: "goggles-of-night",
  type: "wondrous",
  rarity: "uncommon",
  grants: { senses: { darkvision: 60 } },
  attunement: false,
};

// Item whose resistance is a per-instance chosen damage type. The item entity
// carries no intrinsic `resist`; the player/GM picks the type via
// EquipmentEntry.overrides.resist. Requires attunement.
export const ARMOR_OF_RESISTANCE: ItemEntity = {
  name: "Armor of Resistance (Breastplate)",
  slug: "armor-of-resistance",
  type: "armor",
  rarity: "rare",
  base_item: "breastplate",
  attunement: { required: true },
};

export function buildEquipmentRegistry(): EntityRegistry {
  return buildMockRegistry([
    { slug: "plate", entityType: "armor", name: "Plate", data: PLATE },
    { slug: "studded-leather", entityType: "armor", name: "Studded Leather", data: STUDDED_LEATHER },
    { slug: "breastplate", entityType: "armor", name: "Breastplate", data: BREASTPLATE },
    { slug: "shield", entityType: "armor", name: "Shield", data: SHIELD },
    { slug: "club", entityType: "weapon", name: "Club", data: CLUB },
    { slug: "longsword", entityType: "weapon", name: "Longsword", data: LONGSWORD },
    { slug: "shortsword", entityType: "weapon", name: "Shortsword", data: SHORTSWORD },
    { slug: "rapier", entityType: "weapon", name: "Rapier", data: RAPIER },
    { slug: "shortbow", entityType: "weapon", name: "Shortbow", data: SHORTBOW },
    { slug: "greatsword", entityType: "weapon", name: "Greatsword", data: GREATSWORD },
    { slug: "cloak-of-protection", entityType: "item", name: "Cloak of Protection", data: CLOAK_OF_PROTECTION },
    { slug: "flame-tongue", entityType: "item", name: "Flame Tongue", data: FLAME_TONGUE },
    { slug: "plus-one-longsword", entityType: "item", name: "+1 Longsword", data: PLUS_ONE_LONGSWORD },
    { slug: "sun-blade", entityType: "item", name: "Sun Blade", data: SUN_BLADE },
    {
      slug: "belt-of-hill-giant-strength",
      entityType: "item",
      name: "Belt of Hill Giant Strength",
      data: BELT_OF_HILL_GIANT_STRENGTH,
    },
    { slug: "headband-of-intellect", entityType: "item", name: "Headband of Intellect", data: HEADBAND_OF_INTELLECT },
    { slug: "wand-of-fireballs", entityType: "item", name: "Wand of Fireballs", data: WAND_OF_FIREBALLS },
    { slug: "adamantine-breastplate", entityType: "item", name: "Adamantine Armor (Breastplate)", data: ADAMANTINE_BREASTPLATE },
    { slug: "breastplate-3", entityType: "item", name: "Breastplate (+3)", data: BREASTPLATE_PLUS_3 },
    { slug: "heavy-shield", entityType: "armor", name: "Shield", data: HEAVY_SHIELD },
    { slug: "goggles-of-night", entityType: "item", name: "Goggles of Night", data: GOGGLES_OF_NIGHT },
    { slug: "armor-of-resistance", entityType: "item", name: "Armor of Resistance (Breastplate)", data: ARMOR_OF_RESISTANCE },
    // vault-path resolution target: same Breastplate under its compendium-prefixed slug
    { slug: "srd-2024_breastplate", entityType: "armor", name: "Breastplate", data: BREASTPLATE },
  ]);
}
