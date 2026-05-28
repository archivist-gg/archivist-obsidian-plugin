import { describe, it, expect } from "vitest";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { Character, ResolvedCharacter, ResolvedFeature } from "../src/modules/pc/pc.types";
import type { ItemEntity } from "../src/modules/item/item.types";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import {
  PLATE,
  STUDDED_LEATHER,
  CLOAK_OF_PROTECTION,
} from "./fixtures/pc/equipment-fixtures";

// Magic-item AC fixtures local to this file. Bracers/Ring of Protection are
// not in the shared equipment-fixtures registry yet — declare here so the
// test stays self-contained.
const BRACERS_OF_DEFENSE: ItemEntity = {
  name: "Bracers of Defense",
  slug: "bracers-of-defense",
  type: "wondrous",
  rarity: "rare",
  bonuses: { ac: 2 },
  attunement: { required: true },
};

const RING_OF_PROTECTION: ItemEntity = {
  name: "Ring of Protection",
  slug: "ring-of-protection",
  type: "ring",
  rarity: "rare",
  bonuses: { ac: 1, saving_throws: 1 },
  attunement: { required: true },
};

function buildRegistry() {
  return buildMockRegistry([
    { slug: "plate", entityType: "armor", name: "Plate", data: PLATE },
    { slug: "studded-leather", entityType: "armor", name: "Studded Leather", data: STUDDED_LEATHER },
    { slug: "bracers-of-defense", entityType: "item", name: "Bracers of Defense", data: BRACERS_OF_DEFENSE },
    { slug: "cloak-of-protection", entityType: "item", name: "Cloak of Protection", data: CLOAK_OF_PROTECTION },
    { slug: "ring-of-protection", entityType: "item", name: "Ring of Protection", data: RING_OF_PROTECTION },
  ]);
}

const baseChar = (): Character => ({
  name: "T",
  edition: "2014",
  race: null,
  subrace: null,
  background: null,
  class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [],
  overrides: {},
  state: {
    hp: { current: 10, max: 10, temp: 0 },
    hit_dice: {},
    spell_slots: {},
    concentration: null,
    conditions: [],
    inspiration: 0,
    exhaustion: 0,
  },
});

const mkResolved = (
  definition: Character,
  features: ResolvedFeature[] = [],
): ResolvedCharacter => ({
  definition,
  race: null,
  classes: [],
  background: null,
  feats: [],
  totalLevel: 1,
  features,
  state: definition.state,
});

describe("recalc — magic-item AC bonuses (Bug A)", () => {
  it("applies magic-item AC bonus to unarmored AC (Bracers of Defense, no armor)", () => {
    const c = baseChar();
    c.abilities.dex = 12; // DEX +1
    c.equipment = [
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(13); // 10 + 1 DEX + 2 Bracers
    expect(d.acBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.stringMatching(/Unarmored|Base/),
        }),
        expect.objectContaining({
          source: expect.stringMatching(/DEX/),
          amount: 1,
        }),
        expect.objectContaining({
          source: "Bracers of Defense",
          amount: 2,
          kind: "item",
        }),
      ]),
    );
  });

  it("magic-item AC bonus stacks WITH armor when armor is equipped (regression)", () => {
    // Studded leather: 12 + DEX. DEX 12 → +1. Cloak +1.
    // Expected: 12 + 1 + 1 = 14.
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[studded-leather]]", equipped: true },
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(14);
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).toContain("Studded Leather");
    expect(sources).toContain("Cloak of Protection");
  });

  it("multiple magic-item AC bonuses stack on unarmored AC", () => {
    // No armor; Bracers (+2), Cloak (+1), Ring (+1); DEX 12 → +1.
    // Expected: 10 + 1 + 2 + 1 + 1 = 15.
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
      { item: "[[ring-of-protection]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(15);
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).toContain("Bracers of Defense");
    expect(sources).toContain("Cloak of Protection");
    expect(sources).toContain("Ring of Protection");
  });

  it("monk unarmored defense + magic-item AC bonus", () => {
    // Monk-style structured unarmored_defense flag uses WIS.
    // DEX 14 (+2), WIS 16 (+3). Unarmored = 10 + 2 + 3 = 15.
    // + Bracers (+2) → 17.
    const c = baseChar();
    c.abilities.dex = 14;
    c.abilities.wis = 16;
    c.equipment = [
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
    ];
    const features: ResolvedFeature[] = [
      {
        feature: {
          name: "Unarmored Defense",
          unarmored_defense: { ability: "wis" },
        } as never,
        source: { kind: "class", slug: "monk", level: 1 },
      },
    ];
    const d = recalc(mkResolved(c, features), buildRegistry());

    expect(d.ac).toBe(17);
  });

  it("overrides.ac wins over derived AC even when magic items are equipped (regression)", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
    ];
    c.overrides = { ac: 25 };
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(25);
  });
});
