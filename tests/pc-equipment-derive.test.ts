import { describe, it, expect } from "vitest";
import { computeAppliedBonuses } from "../src/modules/pc/pc.equipment";
import type { Character, ResolvedCharacter } from "../src/modules/pc/pc.types";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";

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

describe("computeAppliedBonuses", () => {
  const registry = buildEquipmentRegistry();
  const profs = { armor: { categories: [], specific: [] }, weapons: { categories: [], specific: [] }, tools: { categories: [], specific: [] } };

  it("empty equipment → zero bonuses", () => {
    const bonuses = computeAppliedBonuses(mkResolved(baseChar()), profs, registry, []);
    expect(bonuses.save_bonus).toBe(0);
    expect(bonuses.ability_bonuses).toEqual({});
    expect(bonuses.ability_statics).toEqual({});
  });

  it("cloak of protection equipped+attuned → +1 saves", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: true, attuned: true }];
    const b = computeAppliedBonuses(mkResolved(c), profs, registry, []);
    expect(b.save_bonus).toBe(1);
  });

  it("cloak of protection equipped but NOT attuned → no bonus (requires attunement)", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: true, attuned: false }];
    const b = computeAppliedBonuses(mkResolved(c), profs, registry, []);
    expect(b.save_bonus).toBe(0);
  });

  it("+1 longsword equipped (no attunement required) → bonus applies regardless", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plus-one-longsword]]", equipped: true, attuned: false }];
    const b = computeAppliedBonuses(mkResolved(c), profs, registry, []);
    expect(b.save_bonus).toBe(0);
    expect(b.ability_bonuses).toEqual({});
  });

  it("belt of giant strength equipped+attuned → STR static 21", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true }];
    const b = computeAppliedBonuses(mkResolved(c), profs, registry, []);
    expect(b.ability_statics.str).toBe(21);
  });

  it("two competing static items on same ability → highest wins + warning", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true },
      { item: "[[headband-of-intellect]]", equipped: true, attuned: true },
    ];
    const warnings: string[] = [];
    const b = computeAppliedBonuses(mkResolved(c), profs, registry, warnings);
    expect(b.ability_statics.str).toBe(21);
    expect(b.ability_statics.int).toBe(19);
    expect(warnings).toEqual([]);
  });

  it("unequipped items contribute nothing", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: false, attuned: true }];
    const b = computeAppliedBonuses(mkResolved(c), profs, registry, []);
    expect(b.save_bonus).toBe(0);
  });

  it("missing slug emits warning", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[ghost-cloak]]", equipped: true, attuned: true }];
    const warnings: string[] = [];
    computeAppliedBonuses(mkResolved(c), profs, registry, warnings);
    expect(warnings.some((w) => w.includes("ghost-cloak"))).toBe(true);
  });
});
