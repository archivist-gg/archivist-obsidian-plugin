// tests/item-bonuses-read.test.ts
import { describe, it, expect } from "vitest";
import { readNumericBonus } from "../src/modules/item/item.bonuses";
import type { ConditionContext } from "../src/modules/item/item.conditions.types";
import { computeSlotsAndAttacks } from "../src/modules/pc/pc.equipment";
import type { Character, ResolvedCharacter } from "../src/modules/pc/pc.types";
import type { ItemEntity } from "../src/modules/item/item.types";
import { LONGSWORD } from "./fixtures/pc/equipment-fixtures";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

const baseCtx: ConditionContext = {
  derived: { equippedSlots: {} },
  classList: [],
  race: null,
  subclasses: [],
};

describe("readNumericBonus", () => {
  it("returns null for undefined", () => {
    expect(readNumericBonus(undefined, baseCtx)).toBeNull();
  });

  it("returns null for zero (flat)", () => {
    expect(readNumericBonus(0, baseCtx)).toBeNull();
  });

  it("returns null for zero value in conditional bonus", () => {
    expect(readNumericBonus({ value: 0, when: [] }, baseCtx)).toBeNull();
  });

  it("returns applied for flat number", () => {
    expect(readNumericBonus(2, baseCtx)).toEqual({ kind: "applied", value: 2 });
  });

  it("returns applied for ConditionalBonus when all true", () => {
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] },
      baseCtx,
    );
    expect(r).toEqual({ kind: "applied", value: 2 });
  });

  it("returns applied for ConditionalBonus with empty when[]", () => {
    expect(readNumericBonus({ value: 3, when: [] }, baseCtx)).toEqual({
      kind: "applied",
      value: 3,
    });
  });

  it("returns skipped when any condition false", () => {
    const ctx: ConditionContext = {
      ...baseCtx,
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    };
    const r = readNumericBonus({ value: 2, when: [{ kind: "no_armor" }] }, ctx);
    expect(r).toEqual({ kind: "skipped" });
  });

  it("returns informational when any condition informational and none false", () => {
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "vs_attack_type", value: "ranged" }] },
      baseCtx,
    );
    expect(r).toEqual({
      kind: "informational",
      value: 2,
      conditions: [{ kind: "vs_attack_type", value: "ranged" }],
    });
  });

  it("false beats informational (engine certainty)", () => {
    const ctx: ConditionContext = {
      ...baseCtx,
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    };
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "no_armor" }, { kind: "underwater" }] },
      ctx,
    );
    expect(r).toEqual({ kind: "skipped" });
  });
});

describe("magicBonusesForWeaponEntry — weapon_damage path (regression)", () => {
  // Regression coverage: pin the weapon_damage → damage-roll path so the
  // canonical merger output (Task 2.2) keeps flowing through pc.equipment.ts.
  const baseChar = (): Character => ({
    name: "T", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [],
    overrides: {},
    state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
  });
  const mkResolved = (definition: Character): ResolvedCharacter => ({
    definition, race: null, classes: [], background: null, feats: [], totalLevel: 1,
    features: [], state: definition.state,
  });
  const fullProfs = {
    armor: { categories: [], specific: [] },
    weapons: { categories: ["simple", "martial"], specific: [] },
    tools: { categories: [], specific: [] },
  };
  const zeroMods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

  it("magicBonusesForWeaponEntry returns dmg=3 when entity.bonuses.weapon_damage = 3", () => {
    // Build a magic longsword whose ItemEntity carries bonuses.weapon_damage = 3.
    // The private magicBonusesForWeaponEntry is exercised via computeSlotsAndAttacks;
    // with STR mod 0 and no per-entry override, the resulting damage flat equals dmg.
    const PLUS_THREE_LONGSWORD: ItemEntity = {
      name: "Longsword +3",
      slug: "plus-three-longsword",
      type: "weapon",
      rarity: "very-rare",
      base_item: "longsword",
      bonuses: { weapon_damage: 3 },
      attunement: false,
    };
    const registry = buildMockRegistry([
      { slug: "longsword", entityType: "weapon", name: "Longsword", data: LONGSWORD },
      {
        slug: "plus-three-longsword",
        entityType: "item",
        name: "Longsword +3",
        data: PLUS_THREE_LONGSWORD,
      },
    ]);
    const c = baseChar();
    c.equipment = [{ item: "[[plus-three-longsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), zeroMods, fullProfs, registry, [], 2);
    // STR mod (0) + magic damage (3) = "+3" appended to base dice.
    expect(d.attacks[0].damageDice).toBe("1d8+3");
  });
});
