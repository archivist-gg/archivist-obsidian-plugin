import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { parsePC } from "@archivist/dnd5e/pc/pc.parser";
import type { Character, DerivedStats, ResolvedCharacter, ResolvedSpell } from "@archivist/dnd5e/pc/pc.types";

const YAML = [
  "name: Mage", "edition: '2014'", "race: null", "subrace: null", "background: null",
  "class:", "  - name: '[[wizard]]'", "    level: 5", "    subclass: null", "    choices: {}",
  "abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 }",
  "ability_method: manual", "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }", "equipment: []", "overrides: {}",
  "state:", "  hp: { current: 30, max: 30, temp: 0 }", "  hit_dice: {}",
  "  spell_slots: {}", "  concentration: null", "  conditions: []", "  inspiration: 0",
].join("\n");

function spell(slug: string, level: number, concentration = false): ResolvedSpell {
  return { entity: { name: slug, level, concentration }, slug, classSlug: "wizard", source: "class", prepared: true, alwaysPrepared: false } as unknown as ResolvedSpell;
}
function make(spells: ResolvedSpell[]) {
  const parsed = parsePC(YAML); if (!parsed.success) throw new Error(parsed.error);
  const char = parsed.data; const onChange = vi.fn();
  const es = new CharacterEditState(
    char,
    () => ({ resolved: { spells } as unknown as ResolvedCharacter, derived: { derivedSpellSlots: { 1: 4, 2: 3, 3: 2 }, pactMagic: null } as unknown as DerivedStats }),
    onChange,
  );
  return { es, char, onChange };
}

describe("CharacterEditState — cast", () => {
  it("castSpell expends a slot of the chosen level", () => {
    const { es, char } = make([spell("magic-missile", 1)]);
    es.castSpell("magic-missile", 3); // upcast at 3rd
    expect(char.state.spell_slots[3].used).toBe(1);
  });

  it("casting a concentration spell sets concentration to its slug", () => {
    const { es, char } = make([spell("haste", 3, true)]);
    es.castSpell("haste", 3);
    expect(char.state.concentration).toBe("haste");
  });

  it("casting a non-concentration spell leaves concentration untouched", () => {
    const { es, char } = make([spell("fireball", 3, false)]);
    char.state.concentration = "bless";
    es.castSpell("fireball", 3);
    expect(char.state.concentration).toBe("bless");
  });

  it("castAsRitual expends no slot", () => {
    const { es, char } = make([spell("detect-magic", 1, true)]);
    es.castAsRitual("detect-magic");
    expect(char.state.spell_slots[1]).toBeUndefined();
    expect(char.state.concentration).toBe("detect-magic"); // still sets concentration
  });

  it("castCantrip expends no slot and never sets concentration", () => {
    const { es, char } = make([spell("fire-bolt", 0)]);
    es.castCantrip("fire-bolt");
    expect(char.state.spell_slots).toEqual({});
    expect(char.state.concentration).toBeNull();
  });
});
