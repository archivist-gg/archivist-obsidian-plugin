import { describe, it, expect } from "vitest";
import type { ItemEntity } from "../src/modules/item/item.types";

// Enumerates every recognised field on ItemEntity.
// Adding a new field requires updating this list — the discipline catches
// silent schema drift like the I3 / I12 / I14 / I20 family of bugs.
const RECOGNIZED_FIELDS: ReadonlyArray<keyof ItemEntity> = [
  "name", "slug", "type", "rarity", "base_item",
  "bonuses",
  "resist", "immune", "vulnerable", "condition_immune",
  "charges", "attached_spells", "attunement",
  "grants", "container", "light",
  "cursed", "sentient", "focus", "tier",
  "damage", "weapon_category", "armor_category",
  "weight", "cost", "source", "page", "edition",
  "description", "entries", "effects", "raw",
  // Legacy (still tolerated; remove individually as consumers migrate)
  "damage_dice", "damage_type", "properties", "recharge", "curse", "value",
];

describe("ItemEntity public surface", () => {
  it("has exactly the fields enumerated above", () => {
    type EnsureExhaustive = Exclude<keyof ItemEntity, typeof RECOGNIZED_FIELDS[number]>;
    // If ItemEntity gains a field not in the list, the union below is non-empty
    // and the never-cast fails type-check.
    const _check: EnsureExhaustive extends never ? true : false = true;
    expect(_check).toBe(true);
  });
});
