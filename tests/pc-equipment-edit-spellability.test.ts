import { describe, it, expect } from "vitest";
import { setSpellcastingAbilityForClass } from "../packages/obsidian/src/modules/pc/pc.equipment-edit";
import { characterToYaml } from "../packages/obsidian/src/modules/pc/pc.yaml-serializer";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

function mkChar(over: Partial<Character> = {}): Character {
  return {
    name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [], overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
    ...over,
  } as Character;
}

describe("setSpellcastingAbilityForClass", () => {
  it("sets a per-class override", () => {
    const c = mkChar();
    setSpellcastingAbilityForClass(c, "bard", "wis");
    expect(c.overrides.spellcasting_ability_by_class).toEqual({ bard: "wis" });
  });

  it("clearing the last key deletes the whole record (no orphan {} in YAML)", () => {
    const c = mkChar();
    setSpellcastingAbilityForClass(c, "bard", "wis");
    setSpellcastingAbilityForClass(c, "bard", null);
    expect(c.overrides.spellcasting_ability_by_class).toBeUndefined();
    expect(characterToYaml(c)).not.toContain("spellcasting_ability_by_class");
  });
});
