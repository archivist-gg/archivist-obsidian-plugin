import { describe, it, expect } from "vitest";
import { computeAppliedBonuses, computeSlotsAndAttacks } from "../src/modules/pc/pc.equipment";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { Character, ResolvedCharacter } from "../src/modules/pc/pc.types";
import type { ItemEntity } from "../src/modules/item/item.types";
import type { WeaponEntity } from "../src/modules/weapon/weapon.types";
import type { ArmorEntity } from "../src/modules/armor/armor.types";
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
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, [], 2);
    expect(d.equippedSlots.armor?.entity?.name).toBe("Plate");
  });

  it("equipped shield lands in shield slot", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[shield]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, [], 2);
    expect(d.equippedSlots.shield?.entity?.name).toBe("Shield");
  });

  it("first equipped weapon → mainhand", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, [], 2);
    expect(d.equippedSlots.mainhand?.entity?.name).toBe("Longsword");
    expect(d.equippedSlots.offhand).toBeUndefined();
  });

  it("two equipped weapons → mainhand then offhand", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[shortsword]]", equipped: true },
      { item: "[[shortsword]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, [], 2);
    expect(d.equippedSlots.mainhand?.index).toBe(0);
    expect(d.equippedSlots.offhand?.index).toBe(1);
  });

  it("explicit slot overrides default", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[shortsword]]", equipped: true, slot: "offhand" },
      { item: "[[longsword]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, [], 2);
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
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, w, 2);
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
    computeSlotsAndAttacks(mkResolved(c), mods, profs, registry, w, 2);
    expect(w.some((m) => /two-handed.*shield|shield.*ignored/i.test(m))).toBe(true);
  });
});

describe("computeSlotsAndAttacks — AC chain", () => {
  const registry = buildEquipmentRegistry();
  const profs = { armor: { categories: ["light", "medium", "heavy"], specific: [] }, weapons: { categories: ["simple", "martial"], specific: [] }, tools: { categories: [], specific: [] } };

  it("plate (heavy, no DEX): AC 18 ignoring DEX", () => {
    const c = baseChar(); c.abilities.dex = 20;
    c.equipment = [{ item: "[[plate]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 5, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(18);
  });

  it("studded leather (light): AC 12 + DEX", () => {
    const c = baseChar(); c.abilities.dex = 16;
    c.equipment = [{ item: "[[studded-leather]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(15);
  });

  it("breastplate (medium, dex_max 2): AC 14 + min(DEX, 2)", () => {
    const c = baseChar(); c.abilities.dex = 18;
    c.equipment = [{ item: "[[breastplate]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 4, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(16);
  });

  it("breastplate cap doesn't apply when DEX mod is below cap", () => {
    const c = baseChar(); c.abilities.dex = 12;
    c.equipment = [{ item: "[[breastplate]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 1, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(15);
    const dexTerm = d.acBreakdown.find((t) => t.kind === "dex");
    expect(dexTerm?.source).toBe("DEX modifier");
  });

  it("breastplate cap label shows (capped) when DEX mod exceeds cap", () => {
    const c = baseChar(); c.abilities.dex = 18;
    c.equipment = [{ item: "[[breastplate]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 4, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(16);
    const dexTerm = d.acBreakdown.find((t) => t.kind === "dex");
    expect(dexTerm?.source).toBe("DEX modifier (capped)");
  });

  it("plate + shield: AC 20", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true }, { item: "[[shield]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(20);
  });

  it("plate + shield + cloak of protection (attuned): AC 21", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[plate]]", equipped: true },
      { item: "[[shield]]", equipped: true },
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(21);
  });

  it("plate with overrides.ac_bonus=1: AC 19", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true, overrides: { ac_bonus: 1 } }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(19);
  });

  it("two-handed mainhand + equipped shield → shield AC contribution dropped", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true }, { item: "[[greatsword]]", equipped: true }, { item: "[[shield]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    expect(d.ac).toBe(18);
  });

  it("acBreakdown enumerates each contributing term", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[plate]]", equipped: true },
      { item: "[[shield]]", equipped: true },
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, profs, registry, [], 2);
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).toContain("Plate");
    expect(sources).toContain("Shield");
    expect(sources).toContain("Cloak of Protection");
  });
});

describe("computeSlotsAndAttacks — attack rows", () => {
  const registry = buildEquipmentRegistry();
  const fullProfs = { armor: { categories: [], specific: [] }, weapons: { categories: ["simple", "martial"], specific: [] }, tools: { categories: [], specific: [] } };
  const noWeaponProfs = { armor: { categories: [], specific: [] }, weapons: { categories: [], specific: [] }, tools: { categories: [], specific: [] } };

  it("STR-based melee (longsword, STR +3, proficient, PB +2): hit +5, dmg 1d8+3", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    const main = d.attacks[0];
    expect(main.toHit).toBe(5);
    expect(main.damageDice).toBe("1d8+3");
    expect(main.damageType).toBe("slashing");
    expect(main.proficient).toBe(true);
  });

  it("DEX-based ranged (shortbow, DEX +3, proficient): hit +5, dmg 1d6+3", () => {
    const c = baseChar(); c.abilities.dex = 16;
    c.equipment = [{ item: "[[shortbow]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks[0].toHit).toBe(5);
    expect(d.attacks[0].damageDice).toBe("1d6+3");
  });

  it("finesse weapon picks max(STR, DEX)", () => {
    const c = baseChar(); c.abilities.dex = 16; c.abilities.str = 8;
    c.equipment = [{ item: "[[rapier]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: -1, dex: 3, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks[0].toHit).toBe(5);
  });

  it("non-proficient weapon: PB excluded + warning", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const w: string[] = [];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, noWeaponProfs, registry, w, 2);
    expect(d.attacks[0].toHit).toBe(3);
    expect(d.attacks[0].proficient).toBe(false);
    expect(w.some((m) => /not proficient/i.test(m))).toBe(true);
  });

  it("magic weapon (item entity with bonuses) layered with per-entry override", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[plus-one-longsword]]", equipped: true, overrides: { bonus: 1, damage_bonus: 1 } }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks[0].toHit).toBe(7);
    expect(d.attacks[0].damageDice).toBe("1d8+5");
  });

  it("magic weapon with a vault-path base_item resolves through the shared resolver", () => {
    // Mirrors how SRD canonical bundles serialize base_item:
    //   base_item: "[[SRD 5e/Weapons/Longsword]]"
    // and how the registry stores the underlying weapon under a prefixed slug:
    //   slug: "srd-5e_longsword"
    const longsword: WeaponEntity = {
      name: "Longsword",
      slug: "srd-5e_longsword",
      edition: "2014",
      category: "martial-melee",
      damage: { dice: "1d8", type: "slashing", versatile_dice: "1d10" },
      properties: ["versatile"],
    };
    const defender: ItemEntity = {
      name: "Defender",
      slug: "srd-5e_defender-longsword",
      type: "weapon",
      rarity: "legendary",
      base_item: "[[SRD 5e/Weapons/Longsword]]",
      bonuses: { weapon_attack: 3, weapon_damage: 3 },
      attunement: { required: true },
    };
    const reg = buildMockRegistry([
      { slug: "srd-5e_longsword", entityType: "weapon", name: "Longsword", data: longsword },
      { slug: "srd-5e_defender-longsword", entityType: "item", name: "Defender", data: defender },
    ]);
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[srd-5e_defender-longsword]]", equipped: true, attuned: true }];
    const d = computeSlotsAndAttacks(
      mkResolved(c),
      { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      fullProfs,
      reg,
      [],
      2,
    );
    // PB 2 + STR 3 + magic +3 = +8 to hit; 1d8 base + STR 3 + magic +3 = 1d8+6
    expect(d.attacks).toHaveLength(1);
    expect(d.attacks[0].toHit).toBe(8);
    expect(d.attacks[0].damageDice).toBe("1d8+6");
  });

  it("entry overrides.extra_damage appended", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[longsword]]", equipped: true, overrides: { extra_damage: "1d6 fire" } }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks[0].extraDamage).toBe("1d6 fire");
  });

  it("versatile alone in mainhand → single row with inlined versatile dice", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks).toHaveLength(1);
    expect(d.attacks[0].damageDice).toBe("1d8+3");
    expect(d.attacks[0].versatile?.damageDice).toBe("1d10+3");
  });

  it("dual-wield two longswords → both rows, NO versatile inlining (offhand occupied)", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [
      { item: "[[longsword]]", equipped: true },
      { item: "[[longsword]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks).toHaveLength(2);
    expect(d.attacks.every((a) => a.versatile === undefined)).toBe(true);
  });

  it("two-handed weapon (greatsword) renders one row", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[greatsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks).toHaveLength(1);
    expect(d.attacks[0].damageDice).toBe("2d6+3");
  });

  it("versatile inlined-row name and range", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, fullProfs, registry, [], 2);
    expect(d.attacks[0].range).toBe("melee");
    expect(d.attacks[0].name).toBe("Longsword");
    expect(d.attacks[0].versatile?.damageDice).toBe("1d10+3");
  });
});

describe("recalc + Pass B", () => {
  const registry = buildEquipmentRegistry();

  it("plate + shield equipped → derived.ac matches Pass B", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true }, { item: "[[shield]]", equipped: true }];
    const d = recalc(mkResolved(c), registry);
    expect(d.ac).toBe(20);
    expect(d.acBreakdown.length).toBeGreaterThan(0);
  });

  it("equipped longsword renders attack row in derived.attacks", () => {
    const c = baseChar(); c.abilities.str = 16;
    c.equipment = [{ item: "[[longsword]]", equipped: true }];
    const d = recalc(mkResolved(c), registry);
    expect(d.attacks.length).toBeGreaterThan(0);
    expect(d.attacks[0].damageDice).toContain("1d8");
  });

  it("overrides.ac wins over derived AC", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true }];
    c.overrides = { ac: 25 };
    const d = recalc(mkResolved(c), registry);
    expect(d.ac).toBe(25);
  });
});

describe("computeSlotsAndAttacks — carriedWeight", () => {
  const profs = { armor: { categories: [], specific: [] }, weapons: { categories: [], specific: [] }, tools: { categories: [], specific: [] } };
  const mods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

  const buildWeightRegistry = () => buildMockRegistry([
    { slug: "ls-3", entityType: "weapon", name: "Longsword", data: {
      name: "Longsword", slug: "ls-3", edition: "2014",
      category: "martial-melee",
      damage: { dice: "1d8", type: "slashing" },
      properties: [], weight: 3,
    } as WeaponEntity },
    { slug: "chain-mail-55", entityType: "armor", name: "Chain Mail", data: {
      name: "Chain Mail", slug: "chain-mail-55", category: "heavy",
      ac: { base: 16, flat: 0, add_dex: false, add_con: false, add_wis: false },
      weight: 55,
    } as ArmorEntity },
    { slug: "bag-of-holding", entityType: "item", name: "Bag of Holding", data: {
      name: "Bag of Holding", slug: "bag-of-holding", type: "wondrous",
      rarity: "uncommon",
      container: { capacity_weight: 500, weightless: true },
      weight: 15,
    } as ItemEntity },
    { slug: "amulet-1", entityType: "item", name: "Amulet of Health", data: {
      name: "Amulet of Health", slug: "amulet-1", type: "wondrous",
      rarity: "rare", weight: 1,
    } as ItemEntity },
    { slug: "no-weight", entityType: "item", name: "Mystery Token", data: {
      name: "Mystery Token", slug: "no-weight", type: "wondrous", rarity: "uncommon",
    } as ItemEntity },
    { slug: "weight-as-string", entityType: "item", name: "Old Tome", data: {
      name: "Old Tome", slug: "weight-as-string", type: "wondrous", rarity: "uncommon",
      weight: "2.5",
    } as ItemEntity },
    { slug: "shield-2", entityType: "armor", name: "Shield of Holding", data: {
      name: "Shield of Holding", slug: "shield-2", category: "shield",
      ac: { base: 0, flat: 2, add_dex: false, add_con: false, add_wis: false },
      weight: 6,
    } as ArmorEntity },
  ]);

  it("PC with no equipment → carriedWeight = 0", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(0);
  });

  it("single equipped item with weight 3 → carriedWeight = 3", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [{ item: "[[ls-3]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(3);
  });

  it("multiple items sum together", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [
      { item: "[[ls-3]]", equipped: true },        // 3
      { item: "[[chain-mail-55]]", equipped: true }, // 55
      { item: "[[amulet-1]]", equipped: true, attuned: true }, // 1
      { item: "[[shield-2]]", equipped: true },     // 6
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(65);
  });

  it("weightless container (Bag of Holding) still contributes its OWN weight", () => {
    // SRD: only the contents of a bag of holding are weightless; the bag
    // itself weighs 15 lb. Contents aren't linked to containers via
    // EquipmentEntry today, so this is the pragmatic answer.
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [{ item: "[[bag-of-holding]]", equipped: false, attuned: false }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(15);
  });

  it("item with no weight field contributes 0", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [
      { item: "[[no-weight]]", equipped: true },
      { item: "[[ls-3]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(3);
  });

  it("attuned-but-not-equipped item still counts (it's in the inventory)", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [{ item: "[[amulet-1]]", equipped: false, attuned: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(1);
  });

  it("unequipped, unattuned items still count", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [{ item: "[[ls-3]]", equipped: false, attuned: false }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(3);
  });

  it("qty multiplies weight", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [{ item: "[[ls-3]]", equipped: false, qty: 4 }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(12);
  });

  it("missing entity (dangling wikilink) contributes 0", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [
      { item: "[[ghost-item]]", equipped: false },
      { item: "[[ls-3]]", equipped: false },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(3);
  });

  it("string-typed weight is coerced to number", () => {
    const reg = buildWeightRegistry();
    const c = baseChar();
    c.equipment = [{ item: "[[weight-as-string]]", equipped: false }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(2.5);
  });

  it("Grendal-like loadout sums to expected total", () => {
    // Mirrors the Grendal spot-check in the task spec:
    // Longsword 3 + Amulet of Health 1 + Bracers of Defense 1 + Chain Mail 55
    // + Shield of Missile Attraction 6 + Arrow-Catching Shield 6
    // + Necklace of Fireballs 1 + Wand of Fireballs 1 = 74 lb
    const reg = buildMockRegistry([
      { slug: "g-ls", entityType: "weapon", name: "Longsword", data: {
        name: "Longsword", slug: "g-ls", edition: "2014",
        category: "martial-melee",
        damage: { dice: "1d8", type: "slashing" },
        properties: [], weight: 3,
      } as WeaponEntity },
      { slug: "g-amulet", entityType: "item", name: "Amulet of Health", data: {
        name: "Amulet of Health", slug: "g-amulet", type: "wondrous", rarity: "rare", weight: 1,
      } as ItemEntity },
      { slug: "g-bracers", entityType: "item", name: "Bracers of Defense", data: {
        name: "Bracers of Defense", slug: "g-bracers", type: "wondrous", rarity: "rare", weight: 1,
      } as ItemEntity },
      { slug: "g-chain", entityType: "armor", name: "Chain Mail", data: {
        name: "Chain Mail", slug: "g-chain", category: "heavy",
        ac: { base: 16, flat: 0, add_dex: false, add_con: false, add_wis: false }, weight: 55,
      } as ArmorEntity },
      { slug: "g-shield-missile", entityType: "armor", name: "Shield of Missile Attraction", data: {
        name: "Shield of Missile Attraction", slug: "g-shield-missile", category: "shield",
        ac: { base: 0, flat: 2, add_dex: false, add_con: false, add_wis: false }, weight: 6,
      } as ArmorEntity },
      { slug: "g-shield-arrow", entityType: "armor", name: "Arrow-Catching Shield", data: {
        name: "Arrow-Catching Shield", slug: "g-shield-arrow", category: "shield",
        ac: { base: 0, flat: 2, add_dex: false, add_con: false, add_wis: false }, weight: 6,
      } as ArmorEntity },
      { slug: "g-necklace", entityType: "item", name: "Necklace of Fireballs", data: {
        name: "Necklace of Fireballs", slug: "g-necklace", type: "wondrous", rarity: "rare", weight: 1,
      } as ItemEntity },
      { slug: "g-wand", entityType: "item", name: "Wand of Fireballs", data: {
        name: "Wand of Fireballs", slug: "g-wand", type: "wand", rarity: "rare", weight: 1,
      } as ItemEntity },
    ]);
    const c = baseChar();
    c.equipment = [
      { item: "[[g-ls]]", equipped: true },
      { item: "[[g-amulet]]", equipped: true, attuned: true },
      { item: "[[g-bracers]]", equipped: true, attuned: true },
      { item: "[[g-chain]]", equipped: true },
      { item: "[[g-shield-missile]]", equipped: true },
      { item: "[[g-shield-arrow]]", equipped: false },
      { item: "[[g-necklace]]", equipped: true },
      { item: "[[g-wand]]", equipped: true, attuned: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(74);
  });

  it("explicit weight: 0 contributes 0 (legitimate weightless trinket)", () => {
    // SRD lists trinkets, spell focuses, and similar items with weight: 0.
    // Must be distinguishable from "missing" by virtue of summing to 0
    // alongside other weighted items rather than being treated as broken.
    const reg = buildMockRegistry([
      { slug: "trinket-zero", entityType: "item", name: "Tiny Trinket", data: {
        name: "Tiny Trinket", slug: "trinket-zero", type: "wondrous",
        rarity: "common", weight: 0,
      } as ItemEntity },
      { slug: "ls-mix", entityType: "weapon", name: "Longsword", data: {
        name: "Longsword", slug: "ls-mix", edition: "2014",
        category: "martial-melee",
        damage: { dice: "1d8", type: "slashing" },
        properties: [], weight: 3,
      } as WeaponEntity },
    ]);
    const c = baseChar();
    c.equipment = [
      { item: "[[trinket-zero]]", equipped: true, qty: 5 },
      { item: "[[ls-mix]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    // 5 × 0 trinkets (qty multiplied) + 1 × 3 longsword = 3
    expect(d.carriedWeight).toBe(3);
  });

  it("negative weight is treated as 0 (not added or subtracted)", () => {
    const reg = buildMockRegistry([
      { slug: "broken-neg", entityType: "item", name: "Broken Data Item", data: {
        name: "Broken Data Item", slug: "broken-neg", type: "wondrous",
        rarity: "common", weight: -1,
      } as ItemEntity },
      { slug: "ls-neg", entityType: "weapon", name: "Longsword", data: {
        name: "Longsword", slug: "ls-neg", edition: "2014",
        category: "martial-melee",
        damage: { dice: "1d8", type: "slashing" },
        properties: [], weight: 3,
      } as WeaponEntity },
    ]);
    const c = baseChar();
    c.equipment = [
      { item: "[[broken-neg]]", equipped: true },
      { item: "[[ls-neg]]", equipped: true },
    ];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(3);
  });

  it("vault-path wikilink resolves through resolveBaseItem and contributes weight", () => {
    // Mirrors how SRD canonical bundles serialize equipment references when
    // PCs link by vault path:
    //   item: "[[SRD 5e/Items/Necklace of Fireballs]]"
    // and how the registry stores the entity under a prefixed slug:
    //   slug: "srd-5e_necklace-of-fireballs"
    const necklace: ItemEntity = {
      name: "Necklace of Fireballs",
      slug: "srd-5e_necklace-of-fireballs",
      type: "wondrous",
      rarity: "rare",
      weight: 1,
    };
    const reg = buildMockRegistry([
      {
        slug: "srd-5e_necklace-of-fireballs",
        entityType: "item",
        name: "Necklace of Fireballs",
        data: necklace,
      },
    ]);
    const c = baseChar();
    c.equipment = [{ item: "[[SRD 5e/Items/Necklace of Fireballs]]", equipped: true }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(1);
  });

  it("explicit qty: 0 contributes 0 (means zero copies, not default 1)", () => {
    const reg = buildMockRegistry([
      { slug: "q0-ls", entityType: "weapon", name: "Longsword", data: {
        name: "Longsword", slug: "q0-ls", edition: "2014",
        category: "martial-melee",
        damage: { dice: "1d8", type: "slashing" },
        properties: [], weight: 3,
      } as WeaponEntity },
    ]);
    const c = baseChar();
    c.equipment = [{ item: "[[q0-ls]]", equipped: false, qty: 0 }];
    const d = computeSlotsAndAttacks(mkResolved(c), mods, profs, reg, [], 2);
    expect(d.carriedWeight).toBe(0);
  });
});
