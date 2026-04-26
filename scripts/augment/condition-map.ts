// scripts/augment/condition-map.ts
//
// Curated mapping of (item slug -> bonus field -> Condition[]) for items
// whose conditions have been manually verified against SRD prose.
// Trusted source - overrides regex extractor when present.

import type {
  BonusFieldPath,
  Condition,
} from "../../src/modules/item/item.conditions.types";

type ConditionPerField = Partial<Record<BonusFieldPath, Condition[]>>;

export const CURATED_CONDITIONS_MAP: Record<string, ConditionPerField> = {
  "bracers-of-defense": {
    ac: [{ kind: "no_armor" }, { kind: "no_shield" }],
  },
  "arrow-catching-shield": {
    ac: [{ kind: "vs_attack_type", value: "ranged" }],
  },
  "bracers-of-archery": {
    weapon_damage: [
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
  "sun-blade": {
    weapon_damage: [{ kind: "vs_creature_type", value: "undead" }],
  },
  "mace-of-smiting": {
    weapon_attack: [{ kind: "vs_creature_type", value: "construct" }],
    weapon_damage: [{ kind: "vs_creature_type", value: "construct" }],
  },
  "axe-of-the-dwarvish-lords": {
    weapon_damage: [{ kind: "is_race", value: "dwarf" }],
  },
  "cloak-of-the-manta-ray": {
    "speed.swim": [{ kind: "underwater" }],
  },
  "badge-of-the-watch": {
    ac: [{ kind: "no_shield" }],
  },
  "black-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "blue-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "green-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "red-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "white-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
};
