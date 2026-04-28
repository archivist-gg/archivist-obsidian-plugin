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

  it("expendCharge seeds state.charges when absent and defaultMax provided", () => {
    const c = baseChar();
    delete c.equipment[0].state?.charges;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendCharge(0, 7);
    expect(c.equipment[0].state?.charges).toEqual({ current: 6, max: 7 });
  });

  it("expendCharge no-ops when state absent and no defaultMax", () => {
    const c = baseChar();
    delete c.equipment[0].state?.charges;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendCharge(0);
    expect(c.equipment[0].state?.charges).toBeUndefined();
  });

  it("restoreCharge seeds state.charges to full on first call when absent", () => {
    const c = baseChar();
    delete c.equipment[0].state?.charges;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.restoreCharge(0, 7);
    expect(c.equipment[0].state?.charges).toEqual({ current: 7, max: 7 });
  });

  it("setItemCharges sets current = max - newUsed", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setItemCharges(0, 3, 7);
    expect(c.equipment[0].state?.charges?.current).toBe(4);
    es.setItemCharges(0, 0, 7);
    expect(c.equipment[0].state?.charges?.current).toBe(7);
  });

  it("setItemCharges seeds state.charges when absent and clamps", () => {
    const c = baseChar();
    delete c.equipment[0].state?.charges;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setItemCharges(0, 2, 7);
    expect(c.equipment[0].state?.charges).toEqual({ current: 5, max: 7 });
  });

  it("setItemCharges clamps newUsed into [0, max]", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setItemCharges(0, -5, 7);
    expect(c.equipment[0].state?.charges?.current).toBe(7);
    es.setItemCharges(0, 99, 7);
    expect(c.equipment[0].state?.charges?.current).toBe(0);
  });

  it("setItemCharges no-ops when state absent and no defaultMax", () => {
    const c = baseChar();
    delete c.equipment[0].state?.charges;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setItemCharges(0, 2);
    expect(c.equipment[0].state?.charges).toBeUndefined();
  });
});
