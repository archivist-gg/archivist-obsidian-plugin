// tests/__fixtures__/items-conditional.ts
//
// Hand-crafted ItemEntity records used across recalc, augmenter, and UI
// tests. Kept small and focused - each fixture exercises a different
// condition shape.

import type { ItemEntity } from "../../src/modules/item/item.types";

export const bracersOfDefense: ItemEntity = {
  name: "Bracers of Defense",
  slug: "bracers-of-defense",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    ac: { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] },
  },
};

export const arrowCatchingShield: ItemEntity = {
  name: "Arrow-Catching Shield",
  slug: "arrow-catching-shield",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    ac: { value: 2, when: [{ kind: "vs_attack_type", value: "ranged" }] },
  },
};

export const sunBlade: ItemEntity = {
  name: "Sun Blade",
  slug: "sun-blade",
  rarity: "rare",
  attunement: { required: true },
  base_item: "longsword",
  bonuses: {
    weapon_attack: 2,
    weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] },
  },
};

export const bracersOfArchery: ItemEntity = {
  name: "Bracers of Archery",
  slug: "bracers-of-archery",
  rarity: "uncommon",
  attunement: { required: true },
  bonuses: {
    weapon_damage: {
      value: 2,
      when: [
        { kind: "on_attack_type", value: "ranged" },
        {
          kind: "any_of",
          conditions: [
            { kind: "with_weapon_property", value: "longbow" },
            { kind: "with_weapon_property", value: "shortbow" },
          ],
        },
      ],
    },
  },
};

export const cloakOfTheMantaRay: ItemEntity = {
  name: "Cloak of the Manta Ray",
  slug: "cloak-of-the-manta-ray",
  rarity: "uncommon",
  bonuses: {
    speed: { swim: { value: 60, when: [{ kind: "underwater" }] } },
  },
};

export const cloakOfProtection: ItemEntity = {
  name: "Cloak of Protection",
  slug: "cloak-of-protection",
  rarity: "uncommon",
  attunement: { required: true },
  bonuses: { ac: 1, saving_throws: 1 },
};
