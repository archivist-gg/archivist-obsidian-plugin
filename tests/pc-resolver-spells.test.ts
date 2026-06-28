import { describe, it, expect } from "vitest";
import { PCResolver } from "../packages/obsidian/src/modules/pc/pc.resolver";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { Character } from "../packages/obsidian/src/modules/pc/pc.types";

function char(known: Character["spells"]["known"]): Character {
  return {
    name: "Mage", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "[[wizard]]", level: 5, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known, overrides: [] }, equipment: [], overrides: {},
    state: { hp: { current: 30, max: 30, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  };
}

const REG = buildMockRegistry([
  { slug: "wizard", entityType: "class", data: { slug: "wizard", name: "Wizard", spellcasting: { caster_type: "full", ability: "int", preparation: "prepared", spell_list: "wizard" }, table: {}, features_by_level: {} } },
  { slug: "fireball", entityType: "spell", data: { name: "Fireball", level: 3, school: "evocation", classes: ["wizard"] } },
  { slug: "fire-bolt", entityType: "spell", data: { name: "Fire Bolt", level: 0, school: "evocation", classes: ["wizard"] } },
]);

describe("PCResolver — spells", () => {
  it("resolves bare-slug cantrips as prepared (always ready)", () => {
    const { character } = new PCResolver(REG).resolve(char(["[[fire-bolt]]"]));
    expect(character.spells).toHaveLength(1);
    expect(character.spells[0].entity.name).toBe("Fire Bolt");
    expect(character.spells[0].prepared).toBe(true);       // cantrip
    expect(character.spells[0].classSlug).toBe("wizard");  // sole caster
  });

  it("resolves object-form with explicit prepared + source", () => {
    const { character } = new PCResolver(REG).resolve(char([{ spell: "[[fireball]]", prepared: true, source: "class" }]));
    expect(character.spells[0].entity.level).toBe(3);
    expect(character.spells[0].prepared).toBe(true);
    expect(character.spells[0].alwaysPrepared).toBe(false);
  });

  it("emits a warning for an unresolved spell slug but does not throw", () => {
    const { character, warnings } = new PCResolver(REG).resolve(char(["[[missing-spell]]"]));
    expect(character.spells).toHaveLength(0);
    expect(warnings.some((w) => w.includes("missing-spell"))).toBe(true);
  });
});
