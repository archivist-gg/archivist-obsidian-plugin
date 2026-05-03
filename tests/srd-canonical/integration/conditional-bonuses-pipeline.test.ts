// tests/srd-canonical/integration/conditional-bonuses-pipeline.test.ts
import { describe, it, expect } from "vitest";
import {
  enrichItemsWithFoundryEffects,
  enrichItemsWithCuratedConditions,
  toItemCanonical,
} from "../../../tools/srd-canonical/merger-rules/item-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";
import type { FoundryItem } from "../../../tools/srd-canonical/sources/foundry-items";

function entryFor(name: string, structured: Record<string, unknown> | null = null, baseExtra: Record<string, unknown> = {}): CanonicalEntry {
  const slug = `srd-5e_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return {
    slug,
    edition: "2014",
    kind: "item",
    base: {
      key: slug,
      name,
      rarity: "rare",
      requires_attunement: true,
      ...baseExtra,
    },
    structured: structured as never,
    activation: null,
    overlay: null,
  } as CanonicalEntry;
}

describe("conditional-bonuses pipeline", () => {
  it("Bracers of Defense → bonuses.ac.when = [no_armor, no_shield]", () => {
    const entries = [entryFor("Bracers of Defense", { name: "Bracers of Defense", source: "DMG", bonusAc: "+2" })];
    const items = entries.map(toItemCanonical);
    enrichItemsWithFoundryEffects(items, new Map());
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ac).toEqual({
      value: 2,
      when: [{ kind: "no_armor" }, { kind: "no_shield" }],
    });
  });

  it("Arrow-Catching Shield → bonuses.ac.when = [vs_attack_type: ranged]", () => {
    const entries = [entryFor("Arrow-Catching Shield", { name: "Arrow-Catching Shield", source: "DMG", bonusAc: "+2" })];
    const items = entries.map(toItemCanonical);
    enrichItemsWithFoundryEffects(items, new Map());
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ac).toEqual({
      value: 2,
      when: [{ kind: "vs_attack_type", value: "ranged" }],
    });
  });

  it("Bracers of Archery → curated when[] overrides foundry when[]", () => {
    const entries = [entryFor("Bracers of Archery", { name: "Bracers of Archery", source: "DMG", bonusWeaponDamage: "+2" })];
    const items = entries.map(toItemCanonical);
    const foundry = new Map<string, FoundryItem>([
      ["bracers-of-archery", {
        name: "Bracers of Archery",
        source: "DMG",
        effects: [{ changes: [{ key: "system.bonuses.rwak.damage", mode: "ADD", value: "+ 2" }] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.weapon_damage).toMatchObject({
      value: 2,
      when: [
        { kind: "on_attack_type", value: "ranged" },
        { kind: "any_of" },
      ],
    });
  });

  it("Cloak of Protection → bonuses.ac stays flat (1)", () => {
    const entries = [entryFor("Cloak of Protection", { name: "Cloak of Protection", source: "DMG", bonusAc: 1, bonusSavingThrow: 1 })];
    const items = entries.map(toItemCanonical);
    enrichItemsWithFoundryEffects(items, new Map());
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ac).toBe(1);
    expect(items[0].bonuses?.saving_throws).toBe(1);
  });

  it("Amulet of Health → bonuses.ability_scores.static.con = 19 (foundry-derived)", () => {
    const entries = [entryFor("Amulet of Health", { name: "Amulet of Health", source: "DMG" })];
    const items = entries.map(toItemCanonical);
    const foundry = new Map<string, FoundryItem>([
      ["amulet-of-health", {
        name: "Amulet of Health",
        source: "DMG",
        effects: [{ changes: [{ key: "system.abilities.con.value", mode: "ADD", value: 19 }] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ability_scores?.static?.con).toBe(19);
  });
});
