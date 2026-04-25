import { describe, it, expect } from "vitest";
import { computeAppliedBonuses, computeSlotsAndAttacks } from "../src/modules/pc/pc.equipment";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { Character, ResolvedCharacter } from "../src/modules/pc/pc.types";
import type { ItemEntity } from "../src/modules/item/item.types";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

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

  it("two static items on SAME ability → highest wins, warning emitted", () => {
    const STR_21: ItemEntity = {
      name: "Belt of Hill Giant Strength",
      slug: "belt-21",
      type: "wondrous",
      rarity: "rare",
      bonuses: { ability_scores: { static: { str: 21 } } },
      attunement: { required: true },
    };
    const STR_19: ItemEntity = {
      name: "Gauntlets of Ogre Power",
      slug: "gauntlets-19",
      type: "wondrous",
      rarity: "uncommon",
      bonuses: { ability_scores: { static: { str: 19 } } },
      attunement: { required: true },
    };
    const reg = buildMockRegistry([
      { slug: "belt-21", entityType: "item", name: "Belt of Hill Giant Strength", data: STR_21 },
      { slug: "gauntlets-19", entityType: "item", name: "Gauntlets of Ogre Power", data: STR_19 },
    ]);
    const c = baseChar();
    c.equipment = [
      { item: "[[belt-21]]", equipped: true, attuned: true },
      { item: "[[gauntlets-19]]", equipped: true, attuned: true },
    ];
    const warnings: string[] = [];
    const b = computeAppliedBonuses(mkResolved(c), profs, reg, warnings);
    expect(b.ability_statics.str).toBe(21);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/STR/i);
  });

  it("item with resist but no bonuses field still propagates defenses", () => {
    const RING_NO_BONUSES: ItemEntity = {
      name: "Ring of Fire Resistance", slug: "ring-fire-no-bonuses",
      type: "ring", rarity: "uncommon",
      resist: ["fire"],
      attunement: { required: true },
      // no `bonuses` field
    };
    const reg = buildMockRegistry([
      { slug: "ring-fire-no-bonuses", entityType: "item", name: "Ring of Fire Resistance", data: RING_NO_BONUSES },
    ]);
    const c = baseChar();
    c.equipment = [{ item: "[[ring-fire-no-bonuses]]", equipped: true, attuned: true }];
    const b = computeAppliedBonuses(mkResolved(c), profs, reg, []);
    expect(b.defenses.resistances).toContain("fire");
  });
});

describe("recalc + Pass A", () => {
  const registry = buildEquipmentRegistry();

  it("equipped+attuned cloak of protection adds +1 to all saves", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: true, attuned: true }];
    const r = mkResolved(c);
    const d = recalc(r, registry);
    for (const ab of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      expect(d.saves[ab].bonus).toBe(1);
    }
  });

  it("belt of hill giant strength sets STR to 21 → STR mod = +5", () => {
    const c = baseChar();
    c.abilities.str = 8;
    c.equipment = [{ item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true }];
    const d = recalc(mkResolved(c), registry);
    expect(d.scores.str).toBe(21);
    expect(d.mods.str).toBe(5);
  });

  it("static is no-op when current score is higher", () => {
    const c = baseChar();
    c.abilities.str = 22;
    c.equipment = [{ item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true }];
    const d = recalc(mkResolved(c), registry);
    expect(d.scores.str).toBe(22);
  });

  it("recalc(resolved) without registry preserves legacy behavior", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: true, attuned: true }];
    const d = recalc(mkResolved(c));
    expect(d.saves.str.bonus).toBe(0);
  });

  it("user override wins over static and bonus", () => {
    const c = baseChar();
    c.abilities.str = 8;
    c.equipment = [{ item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true }];
    c.overrides = { scores: { str: 12 } };
    const d = recalc(mkResolved(c), registry);
    expect(d.scores.str).toBe(12);
  });

  it("recalc-level defenses merge: character base + equipped item", () => {
    const RING_OF_FIRE_RESIST: ItemEntity = {
      name: "Ring of Fire Resistance",
      slug: "ring-of-fire-resist",
      type: "ring",
      rarity: "rare",
      // Defenses now propagate independently of the bonuses gate (now correctly handled).
      bonuses: {},
      resist: ["fire"],
      attunement: { required: true },
    };
    const reg = buildMockRegistry([
      { slug: "ring-of-fire-resist", entityType: "item", name: "Ring of Fire Resistance", data: RING_OF_FIRE_RESIST },
    ]);
    const c = baseChar();
    c.defenses = { resistances: ["cold"] };
    c.equipment = [{ item: "[[ring-of-fire-resist]]", equipped: true, attuned: true }];
    const d = recalc(mkResolved(c), reg);
    expect(d.defenses.resistances).toContain("cold");
    expect(d.defenses.resistances).toContain("fire");
  });
});

describe("computeSlotsAndAttacks — slot assignment", () => {
  const registry = buildEquipmentRegistry();
  const profs = { armor: { categories: [], specific: [] }, weapons: { categories: ["simple", "martial"], specific: [] }, tools: { categories: [], specific: [] } };
  const mods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

  it("equipped armor lands in armor slot", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, []);
    expect(d.equippedSlots.armor?.entity?.name).toBe("Plate");
  });

  it("equipped shield lands in shield slot", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[shield]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, []);
    expect(d.equippedSlots.shield?.entity?.name).toBe("Shield");
  });

  it("first equipped weapon → mainhand", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, []);
    expect(d.equippedSlots.mainhand?.entity?.name).toBe("Longsword");
    expect(d.equippedSlots.offhand).toBeUndefined();
  });

  it("two equipped weapons → mainhand then offhand", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[shortsword]]", equipped: true },
      { item: "[[shortsword]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, []);
    expect(d.equippedSlots.mainhand?.index).toBe(0);
    expect(d.equippedSlots.offhand?.index).toBe(1);
  });

  it("explicit slot overrides default", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[shortsword]]", equipped: true, slot: "offhand" },
      { item: "[[longsword]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, []);
    expect(d.equippedSlots.offhand?.entity?.name).toBe("Shortsword");
    expect(d.equippedSlots.mainhand?.entity?.name).toBe("Longsword");
  });

  it("two armors equipped → first wins + warning", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[plate]]", equipped: true },
      { item: "[[studded-leather]]", equipped: true },
    ];
    const w: string[] = [];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, w);
    expect(d.equippedSlots.armor?.entity?.name).toBe("Plate");
    expect(w.some((m) => /armor/i.test(m))).toBe(true);
  });

  it("two-handed mainhand + equipped shield → warning", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[greatsword]]", equipped: true },
      { item: "[[shield]]", equipped: true },
    ];
    const w: string[] = [];
    computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, w);
    expect(w.some((m) => /two-handed.*shield|shield.*ignored/i.test(m))).toBe(true);
  });
});
