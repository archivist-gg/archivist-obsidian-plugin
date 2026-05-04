// tests/srd-canonical/integration/conditional-bonuses-pipeline.test.ts
import { describe, it, expect } from "vitest";
import {
  enrichItemsWithFoundryEffects,
  enrichItemsWithCuratedConditions,
  toItemCanonical,
} from "../../../tools/srd-canonical/merger-rules/item-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";
import type { FoundryItem } from "../../../tools/srd-canonical/sources/foundry-items";
import { projectToRuntime } from "../../../tools/srd-canonical/to-runtime";

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

  it("Sun Blade → bonuses.weapon_attack flat, weapon_damage curated vs undead", () => {
    const entries = [entryFor("Sun Blade", { name: "Sun Blade", source: "DMG", bonusWeapon: "+2" })];
    const items = entries.map(toItemCanonical);
    enrichItemsWithFoundryEffects(items, new Map());
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.weapon_attack).toBe(2);
    expect(items[0].bonuses?.weapon_damage).toEqual({
      value: 2,
      when: [{ kind: "vs_creature_type", value: "undead" }],
    });
  });

  it("Mace of Smiting → both weapon_attack and weapon_damage curated vs construct", () => {
    const entries = [entryFor("Mace of Smiting", { name: "Mace of Smiting", source: "DMG", bonusWeapon: "+1" })];
    const items = entries.map(toItemCanonical);
    enrichItemsWithFoundryEffects(items, new Map());
    enrichItemsWithCuratedConditions(items);
    expect(items[0].bonuses?.weapon_attack).toEqual({
      value: 1,
      when: [{ kind: "vs_creature_type", value: "construct" }],
    });
    expect(items[0].bonuses?.weapon_damage).toEqual({
      value: 1,
      when: [{ kind: "vs_creature_type", value: "construct" }],
    });
  });

  it("2024 Sun Blade → base_item from structured fallback + dual-emit weapon bonuses", () => {
    const entry = entryFor("Sun Blade", { name: "Sun Blade", source: "XDMG", baseItem: "longsword|xphb", bonusWeapon: "+2" });
    // Override the entry to mimic Open5e's 2024 Sun Blade shape: weapon: null,
    // edition 2024, and the 2024 slug (so curator-conditions rules keyed on
    // the 2014 slug `srd-5e_sun-blade` don't match this 2024 fixture).
    (entry.base as Record<string, unknown>).weapon = null;
    (entry as { edition: "2014" | "2024" }).edition = "2024";
    (entry as { slug: string }).slug = "srd-2024_sun-blade";
    const items = [entry].map(toItemCanonical);
    enrichItemsWithFoundryEffects(items, new Map());
    enrichItemsWithCuratedConditions(items);
    expect(items[0].base_item).toBe("[[SRD 2024/Weapons/Longsword]]");
    expect(items[0].bonuses?.weapon_attack).toBe(2);
    expect(items[0].bonuses?.weapon_damage).toBe(2);
  });

  it("2024 Sun Blade → emits damage_type + properties from structured 5etools fields", () => {
    const entry = entryFor("Sun Blade", {
      name: "Sun Blade",
      source: "XDMG",
      baseItem: "longsword|xphb",
      bonusWeapon: "+2",
      dmgType: "R",
      property: ["F|XPHB", "V|XPHB"],
    });
    (entry.base as Record<string, unknown>).weapon = null;
    (entry as { edition: "2014" | "2024" }).edition = "2024";
    (entry as { slug: string }).slug = "srd-2024_sun-blade";
    const items = [entry].map(toItemCanonical);
    expect(items[0].base_item).toBe("[[SRD 2024/Weapons/Longsword]]");
    expect(items[0].damage_type).toBe("radiant");
    expect(items[0].properties).toEqual(["finesse", "versatile"]);
  });

  it("2024 Sun Blade → damage_type + properties survive runtime projection", () => {
    const entry = entryFor("Sun Blade", {
      name: "Sun Blade",
      source: "XDMG",
      baseItem: "longsword|xphb",
      bonusWeapon: "+2",
      dmgType: "R",
      property: ["F|XPHB", "V|XPHB"],
    });
    (entry.base as Record<string, unknown>).weapon = null;
    (entry as { edition: "2014" | "2024" }).edition = "2024";
    (entry as { slug: string }).slug = "srd-2024_sun-blade";
    const canonical = toItemCanonical(entry);
    // Magic items are emitted under the "item" runtime kind (see
    // OPEN5E_KIND_TO_ENTITY in tools/srd-canonical/index.ts: magicitems → "item").
    const runtime = projectToRuntime("item", canonical as unknown as Record<string, unknown>);
    expect(runtime.damage_type).toBe("radiant");
    expect(runtime.properties).toEqual(["finesse", "versatile"]);
  });
});
