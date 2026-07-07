import { describe, it, expect } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import type { Character } from "@archivist/dnd5e/pc/pc.types";

function wizard(): Character {
  return {
    name: "W", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "wizard", level: 8, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [],
    overrides: {},
    state: {
      hp: { current: 1, max: 1, temp: 0 }, hit_dice: {},
      spell_slots: { 1: { used: 2, total: 4 }, 2: { used: 2, total: 3 }, 3: { used: 1, total: 2 } },
      concentration: null, conditions: [], inspiration: 0, exhaustion: 0,
      feature_uses: { "wizard:arcane-recovery": { used: 0, max: 1 } },
    },
  } as Character;
}

describe("CharacterEditState — useRecovery", () => {
  it("restores the picked slot levels and spends the recovery use", () => {
    const c = wizard();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.useRecovery("wizard:arcane-recovery", { 1: 1, 3: 1 });   // restore one L1 + one L3
    expect(c.state.spell_slots[1].used).toBe(1);
    expect(c.state.spell_slots[3].used).toBe(0);
    expect(c.state.feature_uses["wizard:arcane-recovery"].used).toBe(1);
  });

  it("no-ops when the recovery use is already spent", () => {
    const c = wizard();
    c.state.feature_uses["wizard:arcane-recovery"].used = 1;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.useRecovery("wizard:arcane-recovery", { 1: 1 });
    expect(c.state.spell_slots[1].used).toBe(2);   // unchanged
  });

  it("ignores slot levels above 5 and never drives used below 0", () => {
    const c = wizard();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.useRecovery("wizard:arcane-recovery", { 1: 99, 6: 1 });
    expect(c.state.spell_slots[1].used).toBe(0);   // clamped, not negative
    expect(c.state.feature_uses["wizard:arcane-recovery"].used).toBe(1);
  });
});
