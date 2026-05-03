// tests/srd-canonical/merger-rules/item-merge-conditions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enrichItemsWithFoundryEffects,
  enrichItemsWithCuratedConditions,
  type ItemCanonical,
} from "../../../tools/srd-canonical/merger-rules/item-merge";
import type { FoundryItem } from "../../../tools/srd-canonical/sources/foundry-items";

function flat(name: string, slug: string, bonuses: ItemCanonical["bonuses"]): ItemCanonical {
  return {
    slug,
    name,
    edition: "2014",
    source: "SRD 5.1",
    rarity: "rare",
    description: "",
    bonuses,
  };
}

describe("enrichItemsWithFoundryEffects", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("wraps a flat bonus in conditional shape using foundry change", () => {
    const items: ItemCanonical[] = [flat("Bracers of Archery", "srd-5e_bracers-of-archery", { weapon_damage: 2 })];
    const foundry = new Map<string, FoundryItem>([
      ["bracers-of-archery", {
        name: "Bracers of Archery",
        source: "DMG",
        effects: [{ changes: [{ key: "system.bonuses.rwak.damage", mode: "ADD", value: "+ 2" }] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    expect(items[0].bonuses?.weapon_damage).toEqual({
      value: 2,
      when: [{ kind: "on_attack_type", value: "ranged" }],
    });
  });

  it("creates the bonus from foundry value when structured had no flat", () => {
    const items: ItemCanonical[] = [flat("Cloak of the Manta Ray", "srd-5e_cloak-of-the-manta-ray", undefined)];
    const foundry = new Map<string, FoundryItem>([
      ["cloak-of-the-manta-ray", {
        name: "Cloak of the Manta Ray",
        source: "DMG",
        effects: [{ changes: [{ key: "system.attributes.movement.swim", mode: "ADD", value: 60 }] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    // movement.swim has empty when[] → collapses to flat number
    expect(items[0].bonuses?.speed?.swim).toBe(60);
  });

  it("applies static ability score setter", () => {
    const items: ItemCanonical[] = [flat("Amulet of Health", "srd-5e_amulet-of-health", undefined)];
    const foundry = new Map<string, FoundryItem>([
      ["amulet-of-health", {
        name: "Amulet of Health",
        source: "DMG",
        effects: [{ changes: [{ key: "system.abilities.con.value", mode: "ADD", value: 19 }] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    expect(items[0].bonuses?.ability_scores?.static?.con).toBe(19);
  });

  it("warns when foundry static contradicts existing structured-rules static", () => {
    const items: ItemCanonical[] = [
      {
        ...flat("Amulet of Health", "srd-5e_amulet-of-health", undefined),
        bonuses: { ability_scores: { static: { con: 20 } } },
      },
    ];
    const foundry = new Map<string, FoundryItem>([
      ["amulet-of-health", {
        name: "Amulet of Health",
        source: "DMG",
        effects: [{ changes: [{ key: "system.abilities.con.value", mode: "ADD", value: 19 }] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    expect(items[0].bonuses?.ability_scores?.static?.con).toBe(20);
    expect(warn).toHaveBeenCalled();
  });

  it("appends side-channel immunities, resistances, senses, proficiency", () => {
    const items: ItemCanonical[] = [flat("Axe of the Dwarvish Lords", "srd-5e_axe-of-the-dwarvish-lords", undefined)];
    const foundry = new Map<string, FoundryItem>([
      ["axe-of-the-dwarvish-lords", {
        name: "Axe of the Dwarvish Lords",
        source: "DMG",
        effects: [{ changes: [
          { key: "system.traits.di.value", mode: "ADD", value: "poison" },
          { key: "system.traits.dr.value", mode: "ADD", value: "fire" },
          { key: "system.attributes.senses.darkvision", mode: "ADD", value: 60 },
          { key: "system.traits.weaponProf.value", mode: "ADD", value: "battleaxe" },
        ] }],
      }],
    ]);
    enrichItemsWithFoundryEffects(items, foundry);
    expect(items[0].immune).toContain("poison");
    expect(items[0].resist).toContain("fire");
    expect(items[0].grants?.senses?.darkvision).toBe(60);
    expect(items[0].grants?.proficiency).toBe(true);
  });

  it("is a no-op for items not in the foundry index", () => {
    const items: ItemCanonical[] = [flat("Cloak of Protection", "srd-5e_cloak-of-protection", { ac: 1 })];
    enrichItemsWithFoundryEffects(items, new Map());
    expect(items[0].bonuses?.ac).toBe(1);
  });
});

describe("enrichItemsWithCuratedConditions", () => {
  it("wraps a flat bonus with curated when[]", () => {
    const items: ItemCanonical[] = [flat("Bracers of Defense", "srd-5e_bracers-of-defense", { ac: 2 })];
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ac).toEqual({
      value: 2,
      when: [{ kind: "no_armor" }, { kind: "no_shield" }],
    });
  });

  it("overrides foundry-derived when[] when curated has the same field", () => {
    const items: ItemCanonical[] = [flat("Bracers of Archery", "srd-5e_bracers-of-archery", {
      weapon_damage: { value: 2, when: [{ kind: "on_attack_type", value: "ranged" }] },
    })];
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.weapon_damage).toMatchObject({
      value: 2,
      when: [
        { kind: "on_attack_type", value: "ranged" },
        { kind: "any_of", conditions: [
          { kind: "with_weapon_property", value: "longbow" },
          { kind: "with_weapon_property", value: "shortbow" },
        ] },
      ],
    });
  });

  it("warns and skips when curated names a field that has no value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const items: ItemCanonical[] = [flat("Bracers of Defense", "srd-5e_bracers-of-defense", undefined)];
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ac).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is a no-op for items not in the curated table", () => {
    const items: ItemCanonical[] = [flat("Cloak of Protection", "srd-5e_cloak-of-protection", { ac: 1 })];
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.ac).toBe(1);
  });

  it("handles speed.swim path with curated underwater condition", () => {
    const items: ItemCanonical[] = [flat("Cloak of the Manta Ray", "srd-5e_cloak-of-the-manta-ray", {
      speed: { swim: 60 },
    })];
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.speed?.swim).toEqual({
      value: 60,
      when: [{ kind: "underwater" }],
    });
  });
});
