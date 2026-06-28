// tests/pc-recalc-conditional-bonuses.test.ts
//
// Integration tests for the conditional-bonus pipeline built in Tasks 8-11.
// Drives `recalc()` end-to-end with magic items whose bonuses carry
// `when: [...]` conditions, and asserts the user-visible derived state
// (ac, acBreakdown, acInformational, attacks, saves, speed).

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { recalc } from "../src/modules/pc/pc.recalc";
import { readNumericBonus } from "../src/modules/item/item.bonuses";
import type { ItemEntity } from "../src/modules/item/item.types";
import type { ConditionContext } from "../src/modules/item/item.conditions.types";
import type {
  Character,
  ResolvedCharacter,
  ResolvedFeature,
  ResolvedClass,
} from "../src/modules/pc/pc.types";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import {
  STUDDED_LEATHER,
  SHIELD,
  LONGSWORD,
} from "./fixtures/pc/equipment-fixtures";
import {
  bracersOfDefense,
  arrowCatchingShield,
  sunBlade,
  cloakOfTheMantaRay,
  cloakOfProtection,
} from "./__fixtures__/items-conditional";

// Minimal conditional fixtures for the informational-slice partition tests
// (Task 7). Each carries a Tier-2+ `when` condition that routes the bonus to
// `informational` (not the flat/applied path):
//   - `vs_spell_save`    (Tier 2) → saving_throws is situational vs spells.
//   - `is_concentrating` (Tier 4) → spell_attack is situational while casting.
// Per item.conditions.ts, both kinds return "informational" in v1.
const amuletVsSpells: ItemEntity = {
  name: "Amulet of Spell Warding",
  slug: "amulet-vs-spells",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    saving_throws: { value: 1, when: [{ kind: "vs_spell_save" }] },
  },
};

const rodOfFocusedCasting: ItemEntity = {
  name: "Rod of Focused Casting",
  slug: "rod-of-focused-casting",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    spell_attack: { value: 1, when: [{ kind: "is_concentrating" }] },
  },
};

const tomeOfWardedMind: ItemEntity = {
  name: "Tome of the Warded Mind",
  slug: "tome-of-warded-mind",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    spell_save_dc: { value: 1, when: [{ kind: "is_concentrating" }] },
  },
};

function buildRegistry() {
  return buildMockRegistry([
    { slug: "studded-leather", entityType: "armor", name: "Studded Leather", data: STUDDED_LEATHER },
    { slug: "shield", entityType: "armor", name: "Shield", data: SHIELD },
    { slug: "longsword", entityType: "weapon", name: "Longsword", data: LONGSWORD },
    { slug: "bracers-of-defense", entityType: "item", name: "Bracers of Defense", data: bracersOfDefense },
    { slug: "arrow-catching-shield", entityType: "item", name: "Arrow-Catching Shield", data: arrowCatchingShield },
    { slug: "sun-blade", entityType: "item", name: "Sun Blade", data: sunBlade },
    { slug: "cloak-of-the-manta-ray", entityType: "item", name: "Cloak of the Manta Ray", data: cloakOfTheMantaRay },
    { slug: "cloak-of-protection", entityType: "item", name: "Cloak of Protection", data: cloakOfProtection },
    { slug: "amulet-vs-spells", entityType: "item", name: "Amulet of Spell Warding", data: amuletVsSpells },
    { slug: "rod-of-focused-casting", entityType: "item", name: "Rod of Focused Casting", data: rodOfFocusedCasting },
    { slug: "tome-of-warded-mind", entityType: "item", name: "Tome of the Warded Mind", data: tomeOfWardedMind },
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
  classes: ResolvedClass[] = [],
): ResolvedCharacter => ({
  definition,
  race: null,
  classes,
  background: null,
  feats: [],
  totalLevel: 1,
  features,
  spells: [],
  state: definition.state,
});

// A fighter-style class entity with martial weapon proficiency, used by the
// Sun Blade test so the longsword AttackRow includes the proficiency bonus.
const martialFighterClass = (): ResolvedClass => ({
  entity: {
    proficiencies: { weapons: { categories: ["martial"] } },
  } as never,
  level: 1,
  subclass: null,
  choices: {},
});

describe("AC with conditional item bonuses", () => {
  it("Bracers of Defense applies +2 when no armor + no shield", () => {
    const c = baseChar();
    c.abilities.dex = 12; // DEX +1
    c.equipment = [
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(13); // 10 + 1 DEX + 2 Bracers
    expect(d.acInformational).toEqual([]);
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).toContain("Bracers of Defense");
  });

  it("Bracers of Defense skips +2 when wearing armor", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[studded-leather]]", equipped: true },
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(13); // 12 studded + 1 DEX, no +2 bracers
    expect(d.acInformational).toEqual([]);
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).not.toContain("Bracers of Defense");
  });

  it("Bracers of Defense skips +2 when holding shield (no armor)", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[shield]]", equipped: true },
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    // Conditional-bonus assertion: Bracers' `no_shield` evaluates to false
    // because the shield slot is filled, so the +2 must NOT be applied.
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).not.toContain("Bracers of Defense");
    // The shield's +2 base AC now applies even with no body armor (RAW: a
    // shield grants +2 whenever wielded; the unarmored-AC path no longer drops
    // the shield term). AC = 10 + 1 DEX + 2 shield = 13. The Bracers' conditional
    // +2 is still correctly skipped because the shield slot is filled (above).
    expect(d.ac).toBe(13);
  });

  it("Arrow-Catching Shield surfaces +2 vs ranged as informational", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[arrow-catching-shield]]", equipped: true, attuned: true, slot: "shield" },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    // Conditional-bonus assertion: the +2 vs ranged bonus is informational
    // and must NOT contribute to the headline AC; instead it surfaces in
    // acInformational with its conditions intact.
    expect(d.acInformational).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "ac",
          source: "Arrow-Catching Shield",
          value: 2,
          conditions: [{ kind: "vs_attack_type", value: "ranged" }],
        }),
      ]),
    );
    // The fixture is an ItemEntity (not an ArmorEntity) and lacks
    // base_item: "shield", so no +2 base shield AC is added by the recalc
    // shield path. AC = 10 + 1 DEX = 11. If item-shields with
    // base_item: "shield" are taught to inherit shield base AC in a future
    // task, this becomes 13.
    expect(d.ac).toBe(11);
  });

  it("Cloak of Protection still works with flat number", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.ac).toBe(12); // 10 + 1 DEX + 1 cloak
    // The cloak's +1 saving_throws should land on every save bonus.
    const baseStr = 0; // STR 10 → +0 mod, no proficiency.
    expect(d.saves.str.bonus).toBe(baseStr + 1);
  });

  it("Mixed: studded-leather + cloak + bracers + arrow-catching shield", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[studded-leather]]", equipped: true },
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
      { item: "[[bracers-of-defense]]", equipped: true, attuned: true },
      { item: "[[arrow-catching-shield]]", equipped: true, attuned: true, slot: "shield" },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    // 12 studded + 1 DEX + 1 cloak = 14; bracers contribute nothing
    // because armor is worn (no_armor false). The arrow-catching shield is
    // an ItemEntity without base_item: "shield", so no +2 base AC is
    // contributed. If item-shields gain base-AC inheritance later, expect 16.
    expect(d.ac).toBe(14);
    const sources = d.acBreakdown.map((t) => t.source);
    expect(sources).not.toContain("Bracers of Defense");
    expect(d.acInformational).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "ac",
          source: "Arrow-Catching Shield",
          value: 2,
          conditions: [{ kind: "vs_attack_type", value: "ranged" }],
        }),
      ]),
    );
  });
});

describe("Weapon damage with conditional item bonuses", () => {
  it("Sun Blade weapon_attack applies, weapon_damage informational vs undead", () => {
    const c = baseChar();
    c.abilities.dex = 12;
    c.equipment = [
      { item: "[[sun-blade]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c, [], [martialFighterClass()]), buildRegistry());

    // Versatile longsword emits two rows (1h standard + 2h versatile); the
    // assertion targets the one-handed standard row.
    const row = d.attacks.find((a) => a.id.endsWith(":standard"));
    expect(row).toBeDefined();
    if (!row) return;
    // STR 10 → +0; martial proficiency → +2 PB; Sun Blade weapon_attack +2 = +4.
    expect(row.toHit).toBe(4);
    // Damage dice should NOT include the +2 (it's vs-undead conditional).
    // Base damage flat = STR mod (0). dmgFlat reduces "+0" to bare dice.
    expect(row.damageDice).toBe("1d8");
    expect(row.informational).toBeDefined();
    expect(row.informational).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "weapon_damage",
          source: "Sun Blade",
          value: 2,
          conditions: [{ kind: "vs_creature_type", value: "undead" }],
        }),
      ]),
    );
  });
});

describe("Speed with conditional item bonuses", () => {
  it("Cloak of the Manta Ray leaves walk speed unchanged (swim bonus is conditional)", () => {
    const c = baseChar();
    c.equipment = [
      // No attunement required for this fixture.
      { item: "[[cloak-of-the-manta-ray]]", equipped: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    // Walk speed stays at the default 30; the conditional underwater swim
    // bonus does not bleed into the headline walk number.
    expect(d.speed).toBe(30);
  });
});

describe("Informational slice partition (saves / spell / speed)", () => {
  it("routes a conditional speed bonus into speedInformational only", () => {
    const c = baseChar();
    c.equipment = [
      // Cloak of the Manta Ray: swim +60 when underwater (Tier-3 informational).
      { item: "[[cloak-of-the-manta-ray]]", equipped: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    // Lands in its own slice...
    expect(d.speedInformational.length).toBeGreaterThan(0);
    expect(d.speedInformational).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "speed.swim",
          source: "Cloak of the Manta Ray",
          value: 60,
          conditions: [{ kind: "underwater" }],
        }),
      ]),
    );
    expect(d.speedInformational.every((i) => i.field.startsWith("speed."))).toBe(true);
    // ...and NOT the other two.
    expect(d.savesInformational).toHaveLength(0);
    expect(d.spellcastingInformational).toHaveLength(0);
  });

  it("routes a conditional saving-throw bonus into savesInformational only (flat save stays out)", () => {
    const c = baseChar();
    c.equipment = [
      // Conditional save (vs spells) → informational.
      { item: "[[amulet-vs-spells]]", equipped: true, attuned: true },
      // Flat +1 saving_throws → applied, must NOT appear in the slice.
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    // Exactly the conditional one lands in the slice.
    expect(d.savesInformational).toEqual([
      expect.objectContaining({
        field: "saving_throws",
        source: "Amulet of Spell Warding",
        value: 1,
        conditions: [{ kind: "vs_spell_save" }],
      }),
    ]);
    // Negative: the flat Cloak of Protection +1 is applied, not informational.
    expect(
      d.savesInformational.some((i) => i.source === "Cloak of Protection"),
    ).toBe(false);
    // And the flat bonus genuinely reached the headline save (proves flat path).
    expect(d.saves.str.bonus).toBe(1); // STR 10 → +0 mod, no prof, +1 flat cloak.

    // Not the other two slices.
    expect(d.spellcastingInformational).toHaveLength(0);
    expect(d.speedInformational).toHaveLength(0);
  });

  it("routes a conditional spell-attack bonus into spellcastingInformational only", () => {
    const c = baseChar();
    c.equipment = [
      // spell_attack +1 while concentrating (Tier-4 informational).
      { item: "[[rod-of-focused-casting]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.spellcastingInformational).toEqual([
      expect.objectContaining({
        field: "spell_attack",
        source: "Rod of Focused Casting",
        value: 1,
        conditions: [{ kind: "is_concentrating" }],
      }),
    ]);
    expect(
      d.spellcastingInformational.every(
        (i) => i.field === "spell_attack" || i.field === "spell_save_dc",
      ),
    ).toBe(true);
    // Not the other two slices.
    expect(d.savesInformational).toHaveLength(0);
    expect(d.speedInformational).toHaveLength(0);
  });

  it("routes a conditional spell_save_dc bonus into spellcastingInformational", () => {
    const c = baseChar();
    c.equipment = [
      // spell_save_dc +1 while concentrating (Tier-4 informational).
      { item: "[[tome-of-warded-mind]]", equipped: true, attuned: true },
    ];
    const d = recalc(mkResolved(c), buildRegistry());

    expect(d.spellcastingInformational).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "spell_save_dc",
          source: "Tome of the Warded Mind",
          value: 1,
          conditions: [{ kind: "is_concentrating" }],
        }),
      ]),
    );
    // Not the other two slices.
    expect(d.savesInformational).toHaveLength(0);
    expect(d.speedInformational).toHaveLength(0);
  });
});

describe("recalc against bundle conditional bonuses", () => {
  let bundle2014: Array<ItemEntity & { slug: string }>;

  beforeAll(() => {
    const file = path.resolve(__dirname, "../src/srd/data/runtime/item.2014.json");
    bundle2014 = JSON.parse(fs.readFileSync(file, "utf8")) as Array<ItemEntity & { slug: string }>;
  });

  function loadBundleItem(slug: string): ItemEntity {
    const found = bundle2014.find(i => i.slug === slug);
    if (!found) throw new Error(`bundle item ${slug} not found`);
    return found;
  }

  function makeBundleContext(overrides: Partial<ConditionContext["derived"]>): ConditionContext {
    return {
      derived: { equippedSlots: {} as never, ...overrides } as ConditionContext["derived"],
      classList: [],
      race: null,
      subclasses: [],
    };
  }

  it("Bracers of Defense applies +2 AC when no armor and no shield", () => {
    const bracers = loadBundleItem("srd-5e_bracers-of-defense");
    expect(bracers.bonuses?.ac).toMatchObject({
      value: 2,
      when: [{ kind: "no_armor" }, { kind: "no_shield" }],
    });
    const ctx = makeBundleContext({ equippedSlots: { armor: undefined, shield: undefined } });
    const out = readNumericBonus(bracers.bonuses?.ac, ctx);
    expect(out).toEqual({ kind: "applied", value: 2 });
  });

  it("Bracers of Defense skips when shield equipped", () => {
    const bracers = loadBundleItem("srd-5e_bracers-of-defense");
    const ctx = makeBundleContext({
      equippedSlots: {
        armor: undefined,
        shield: { entity: { name: "Shield" } } as never,
      },
    });
    const out = readNumericBonus(bracers.bonuses?.ac, ctx);
    expect(out).toEqual({ kind: "skipped" });
  });

  it("Arrow-Catching Shield is informational (Tier 2 vs ranged)", () => {
    const acs = loadBundleItem("srd-5e_arrow-catching-shield");
    expect(acs.bonuses?.ac).toMatchObject({
      value: 2,
      when: [{ kind: "vs_attack_type", value: "ranged" }],
    });
    const ctx = makeBundleContext({ equippedSlots: {} });
    const out = readNumericBonus(acs.bonuses?.ac, ctx);
    expect(out).toMatchObject({ kind: "informational", value: 2 });
  });
});
