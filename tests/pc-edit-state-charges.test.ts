import { describe, it, expect } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import type { Character } from "../src/modules/pc/pc.types";

function baseChar(): Character {
  return {
    name: "T", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [{
      item: "[[wand-of-fireballs]]", equipped: true, attuned: true,
      state: { charges: { current: 7, max: 7 } },
    }],
    overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0, feature_uses: { "second-wind": { used: 0, max: 1 } } },
  } as Character;
}

describe("CharacterEditState — charge mutations", () => {
  it("expendCharge decrements current; restoreCharge increments", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(6);
    es.restoreCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(7);
  });

  it("expendCharge clamps to 0", () => {
    const c = baseChar();
    c.equipment[0].state!.charges!.current = 0;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(0);
  });

  it("restoreCharge clamps to max", () => {
    const c = baseChar();
    c.equipment[0].state!.charges!.current = 7;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.restoreCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(7);
  });

  it("expendFeatureUse increments used; restore decrements", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendFeatureUse("second-wind");
    expect(c.state.feature_uses["second-wind"].used).toBe(1);
    es.restoreFeatureUse("second-wind");
    expect(c.state.feature_uses["second-wind"].used).toBe(0);
  });
});
