import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { parsePC } from "../src/modules/pc/pc.parser";
import type { Character, DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

const YAML = [
  "name: Mage", "edition: '2014'", "race: null", "subrace: null", "background: null",
  "class:", "  - name: '[[wizard]]'", "    level: 5", "    subclass: null", "    choices: {}",
  "abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 }",
  "ability_method: manual", "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }", "equipment: []", "overrides: {}",
  "state:", "  hp: { current: 30, max: 30, temp: 0 }", "  hit_dice: {}",
  "  spell_slots: {}", "  concentration: null", "  conditions: []", "  inspiration: 0",
].join("\n");

function make(derived: Partial<DerivedStats> = {}, over?: (c: Character) => void) {
  const parsed = parsePC(YAML);
  if (!parsed.success) throw new Error(parsed.error);
  const char = parsed.data;
  over?.(char);
  const onChange = vi.fn();
  const es = new CharacterEditState(
    char,
    () => ({
      resolved: { spells: [] } as unknown as ResolvedCharacter,
      derived: { derivedSpellSlots: { 1: 4, 2: 3, 3: 2 }, pactMagic: null, ...derived } as unknown as DerivedStats,
    }),
    onChange,
  );
  return { es, char, onChange };
}

describe("CharacterEditState — slots", () => {
  it("expendSlot increments used, clamped at derived total", () => {
    const { es, char } = make();
    es.expendSlot(1); es.expendSlot(1);
    expect(char.state.spell_slots[1].used).toBe(2);
    for (let i = 0; i < 10; i++) es.expendSlot(1);
    expect(char.state.spell_slots[1].used).toBe(4); // capped at total 4
  });

  it("restoreSlot decrements, floored at 0", () => {
    const { es, char } = make({}, (c) => { c.state.spell_slots = { 2: { used: 2, total: 3 } }; });
    es.restoreSlot(2);
    expect(char.state.spell_slots[2].used).toBe(1);
  });

  it("expendPactSlot uses pactMagic total", () => {
    const { es, char } = make({ pactMagic: { level: 3, total: 2 } });
    es.expendPactSlot(); es.expendPactSlot(); es.expendPactSlot();
    expect(char.state.spell_slots_pact!.used).toBe(2); // capped
  });

  it("setSlotOverride writes overrides.spell_slots; clearSlotOverride removes it", () => {
    const { es, char } = make();
    es.setSlotOverride(4, 1);
    expect(char.overrides.spell_slots).toEqual({ 4: 1 });
    es.clearSlotOverride(4);
    expect(char.overrides.spell_slots?.[4]).toBeUndefined();
  });

  it("breakConcentration clears state.concentration", () => {
    const { es, char } = make({}, (c) => { c.state.concentration = "[[haste]]"; });
    es.breakConcentration();
    expect(char.state.concentration).toBeNull();
  });
});

describe("CharacterEditState — spells view", () => {
  it("setSpellsView persists the view preference", () => {
    const { es, char } = make();
    es.setSpellsView("table");
    expect(char.spells.view).toBe("table");
  });
});
