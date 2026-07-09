import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { parsePC } from "@archivist-gg/dnd5e/pc/pc.parser";
import type { Character, DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

const YAML = [
  "name: Mage", "edition: '2014'", "race: null", "subrace: null", "background: null",
  "class:", "  - name: '[[wizard]]'", "    level: 5", "    subclass: null", "    choices: {}",
  "abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 }",
  "ability_method: manual", "skills: { proficient: [], expertise: [] }",
  "spells: { known: ['[[shield]]'], overrides: [] }", "equipment: []", "overrides: {}",
  "state:", "  hp: { current: 30, max: 30, temp: 0 }", "  hit_dice: {}",
  "  spell_slots: {}", "  concentration: null", "  conditions: []", "  inspiration: 0",
].join("\n");

function make() {
  const parsed = parsePC(YAML); if (!parsed.success) throw new Error(parsed.error);
  const char = parsed.data; const onChange = vi.fn();
  const es = new CharacterEditState(char, () => ({ resolved: { spells: [] } as unknown as ResolvedCharacter, derived: {} as unknown as DerivedStats }), onChange);
  return { es, char, onChange };
}

describe("CharacterEditState — prepare / add / remove", () => {
  it("togglePrepared upgrades a bare slug to object form with prepared:true", () => {
    const { es, char } = make();
    es.togglePrepared("shield");
    expect(char.spells.known[0]).toEqual({ spell: "[[shield]]", prepared: true });
    es.togglePrepared("shield");
    expect(char.spells.known[0]).toEqual({ spell: "[[shield]]", prepared: false });
  });

  it("addKnownSpell appends a bare slug (deduped)", () => {
    const { es, char } = make();
    es.addKnownSpell("fireball");
    expect(char.spells.known).toContain("[[fireball]]");
    es.addKnownSpell("fireball"); // dedupe
    expect(char.spells.known.filter((k) => k === "[[fireball]]").length).toBe(1);
  });

  it("addKnownSpell with class/source writes object form", () => {
    const { es, char } = make();
    es.addKnownSpell("cure-wounds", { class: "cleric", source: "domain", alwaysPrepared: true });
    expect(char.spells.known).toContainEqual({ spell: "[[cure-wounds]]", class: "[[cleric]]", source: "domain", always_prepared: true });
  });

  it("removeKnownSpell removes by slug regardless of entry form", () => {
    const { es, char } = make();
    es.togglePrepared("shield"); // now object form
    es.removeKnownSpell("shield");
    expect(char.spells.known).toHaveLength(0);
  });
});
