// tools/srd-canonical/data/item-conditions.ts
//
// Curated mapping of (edition-prefixed item slug → bonus field → Condition[])
// for SRD magic items whose conditional language was manually verified
// against the printed prose. Authoritative source for the gate; values
// come from layer 2 (foundry) or layer 3 (structured-rules flat).
//
// Originally seeded from git commit c8c7436 (scripts/augment/condition-map.ts)
// after the legacy importer was retired on 2026-05-02. Grown via the audit
// pipeline at tools/srd-canonical/audit-conditions.ts.

import type {
  BonusFieldPath,
  Condition,
} from "../../../src/modules/item/item.conditions.types";

export type ConditionPerField = Partial<Record<BonusFieldPath, Condition[]>>;

/**
 * Keys are full edition-prefixed slugs as they appear in the runtime bundle:
 *   `srd-5e_<slug>`   for 2014 (DMG)
 *   `srd-2024_<slug>` for 2024 (XDMG)
 */
export const CURATED_ITEM_CONDITIONS: Record<string, ConditionPerField> = {
  // --- 2014 (DMG) ---
  "srd-5e_arrow-catching-shield": {
    ac: [{ kind: "vs_attack_type", value: "ranged" }],
  },
  "srd-5e_bracers-of-defense": {
    ac: [{ kind: "no_armor" }, { kind: "no_shield" }],
  },
  "srd-5e_bracers-of-archery": {
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
  "srd-5e_sun-blade": {
    weapon_damage: [{ kind: "vs_creature_type", value: "undead" }],
  },
  "srd-5e_mace-of-smiting": {
    weapon_attack: [{ kind: "vs_creature_type", value: "construct" }],
    weapon_damage: [{ kind: "vs_creature_type", value: "construct" }],
  },
  "srd-5e_axe-of-the-dwarvish-lords": {
    weapon_damage: [{ kind: "is_race", value: "dwarf" }],
  },
  "srd-5e_cloak-of-the-manta-ray": {
    "speed.swim": [{ kind: "underwater" }],
  },
  "srd-5e_badge-of-the-watch": {
    ac: [{ kind: "no_shield" }],
  },
  "srd-5e_black-dragon-mask": { ac: [{ kind: "no_armor" }] },
  "srd-5e_blue-dragon-mask":  { ac: [{ kind: "no_armor" }] },
  "srd-5e_green-dragon-mask": { ac: [{ kind: "no_armor" }] },
  "srd-5e_red-dragon-mask":   { ac: [{ kind: "no_armor" }] },
  "srd-5e_white-dragon-mask": { ac: [{ kind: "no_armor" }] },

  // --- 2024 (XDMG) ---
  // Audit-driven entries land here.
};
