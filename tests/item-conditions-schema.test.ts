// tests/item-conditions-schema.test.ts
import { describe, it, expect } from "vitest";
import { itemEntitySchema } from "../src/modules/item/item.schema";

const baseItem = { name: "Test Item", rarity: "uncommon" };

describe("conditionSchema (via itemEntitySchema.bonuses)", () => {
  it("accepts flat number for backwards compat", () => {
    const r = itemEntitySchema.safeParse({ ...baseItem, bonuses: { ac: 2 } });
    expect(r.success).toBe(true);
  });

  it("accepts ConditionalBonus shape", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 1 condition (is_class)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { weapon_damage: { value: 1, when: [{ kind: "is_class", value: "bard" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 2 condition (vs_creature_type)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 3 condition (underwater)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { speed: { swim: { value: 30, when: [{ kind: "underwater" }] } } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 4 condition (bloodied)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { weapon_damage: { value: 2, when: [{ kind: "bloodied" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a raw condition", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { value: 2, when: [{ kind: "raw", text: "while bloodied at half HP" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts recursive any_of", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: {
        weapon_damage: {
          value: 2,
          when: [
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
    });
    expect(r.success).toBe(true);
  });

  it("accepts mixed flat and conditional fields on the same item", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: {
        ac: 1,
        weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] },
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown condition kind", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { value: 2, when: [{ kind: "not_a_real_kind" }] } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects ConditionalBonus missing value", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { when: [{ kind: "no_armor" }] } },
    });
    expect(r.success).toBe(false);
  });
});
