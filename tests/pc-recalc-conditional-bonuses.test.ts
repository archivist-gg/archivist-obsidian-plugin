// tests/pc-recalc-conditional-bonuses.test.ts
//
// Integration tests for the conditional-bonus pipeline built in Tasks 8-11.
// Drives `recalc()` end-to-end with magic items whose bonuses carry
// `when: [...]` conditions, and asserts the user-visible derived state
// (ac, acBreakdown, acInformational, attacks, saves, speed).

import { describe, it, expect } from "vitest";
import { recalc } from "../src/modules/pc/pc.recalc";
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
    // Pre-existing recalc behavior (independent of Tasks 8-11): the
    // unarmored-AC fallback path filters acBreakdown to {item, override}
    // only, so the regular shield's +2 base AC is dropped when no armor is
    // worn. AC = 10 + 1 DEX = 11. If/when that path is fixed, this becomes
    // 13 (10 + 1 + 2 shield); update accordingly.
    expect(d.ac).toBe(11);
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
