import { describe, it, expect } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

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

  it("setFeatureUse clamps into [0, max]", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setFeatureUse("second-wind", 1);
    expect(c.state.feature_uses["second-wind"].used).toBe(1);
    es.setFeatureUse("second-wind", 99);
    expect(c.state.feature_uses["second-wind"].used).toBe(1);   // clamped to max
    es.setFeatureUse("second-wind", -3);
    expect(c.state.feature_uses["second-wind"].used).toBe(0);   // clamped to 0
  });

  it("setFeatureUse ignores non-finite input", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setFeatureUse("second-wind", 1);
    es.setFeatureUse("second-wind", NaN);
    expect(c.state.feature_uses["second-wind"].used).toBe(1);   // unchanged, not NaN
  });

  it("setFeatureUse no-ops for an unknown key", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.setFeatureUse("missing", 2);
    expect(c.state.feature_uses["missing"]).toBeUndefined();
  });
});

describe("CharacterEditState.spendFeatureUse (R4-G4 §3.2.4)", () => {
  it("§17 row 2: spends the FULL consumes.amount, not one use", () => {
    const c = baseChar();
    c.state.feature_uses["lay-on-hands"] = { used: 0, max: 5 };
    const es = new CharacterEditState(c, {} as never, () => {});
    es.spendFeatureUse("lay-on-hands", 5);
    expect(c.state.feature_uses["lay-on-hands"].used).toBe(5);
  });

  it("§3.3 (a): a single spend leaves used === 1", () => {
    const c = baseChar();
    c.state.feature_uses["fighter-2024:superiority-dice"] = { used: 0, max: 4 };
    const es = new CharacterEditState(c, {} as never, () => {});
    es.spendFeatureUse("fighter-2024:superiority-dice", 1);
    expect(c.state.feature_uses["fighter-2024:superiority-dice"].used).toBe(1);
  });

  it("composes with the clamped primitive: a spend past max stops at max", () => {
    const c = baseChar();
    c.state.feature_uses["lay-on-hands"] = { used: 4, max: 5 };
    const es = new CharacterEditState(c, {} as never, () => {});
    es.spendFeatureUse("lay-on-hands", 3);
    expect(c.state.feature_uses["lay-on-hands"].used).toBe(5);
  });

  it("an unseeded key is a no-op and never fires onChange", () => {
    const c = baseChar();
    let changes = 0;
    const es = new CharacterEditState(c, {} as never, () => { changes += 1; });
    es.spendFeatureUse("monk:ki", 1);
    expect(c.state.feature_uses["monk:ki"]).toBeUndefined();
    expect(changes).toBe(0);
  });
});

/** G8 banked rolls (brief §Design + the 2026-09-17 rulings, SIGN ENCODING after the shuffle review):
 *  `state.feature_rolls[id]` holds every number rolled for the day and values NEVER MOVE · a SPENT
 *  roll is its NEGATIVE (-16 = the spent 16), a live roll is positive, and `feature_uses.used` is
 *  the spent COUNT (|negatives| === used is the writers' invariant). Position i is the same die all
 *  day: click box i, the number above it and no other one changes. */
describe("CharacterEditState — banked rolls (G8, sign encoding)", () => {
  const PORTENT = "wizard-2024:foretelling-roll";

  function bank(used: number, values: number[], max = 2) {
    const c = baseChar();
    c.state.feature_uses[PORTENT] = { used, max };
    if (values.length > 0) c.state.feature_rolls = { [PORTENT]: [...values] };
    let changes = 0;
    const es = new CharacterEditState(c, {} as never, () => { changes += 1; });
    return { c, es, rolls: () => c.state.feature_rolls?.[PORTENT], used: () => c.state.feature_uses[PORTENT].used, changes: () => changes };
  }

  it("setFeatureRolls banks the Roll pill's whole array, in rolled order, all LIVE (positive)", () => {
    const { es, rolls } = bank(0, []);
    es.setFeatureRolls(PORTENT, [7, 19]);
    expect(rolls()).toEqual([7, 19]);
  });

  it("setFeatureRolls keeps only integers 1..999, and never dedupes (two dice do roll the same face)", () => {
    const { es, rolls } = bank(0, []);
    es.setFeatureRolls(PORTENT, [12, 12, 0, -4, 3.5, NaN, 1000, 999, 1]);
    expect(rolls()).toEqual([12, 12, 999, 1]);
  });

  it("an emptied bank DELETES its key, never leaves a [] behind", () => {
    const { es, c, rolls } = bank(0, [7]);
    es.setFeatureRolls(PORTENT, []);
    expect(rolls()).toBeUndefined();
    expect(Object.keys(c.state.feature_rolls ?? {})).toEqual([]);
  });

  it("a bank of only unusable values IS an emptied bank", () => {
    const { es, rolls } = bank(0, [7]);
    es.setFeatureRolls(PORTENT, [0, -1, 1000]);
    expect(rolls()).toBeUndefined();
  });

  it("THE SHUFFLE BUG, pinned: spending a later roll moves NOTHING (sign flips in place)", () => {
    const { es, rolls, used, changes } = bank(0, [7, 19]);
    es.spendFeatureRoll(PORTENT, 1);
    expect(rolls()).toEqual([7, -19]);     // the 19 STAYS at slot 1, the 7 at slot 0
    expect(used()).toBe(1);
    expect(changes()).toBe(1);             // one click, one persist
  });

  it("the live rolls keep their slots when a middle roll is spent", () => {
    const { es, rolls, used } = bank(0, [3, 11, 20], 3);
    es.spendFeatureRoll(PORTENT, 1);
    expect(rolls()).toEqual([3, -11, 20]);
    expect(used()).toBe(1);
  });

  it("restoreFeatureRoll un-spends that box's own value in place and gives the use back", () => {
    const { es, rolls, used } = bank(2, [-3, 11, -20], 3);
    es.restoreFeatureRoll(PORTENT, 0);
    expect(rolls()).toEqual([3, 11, -20]);   // the 20 stays spent, the 3 is live again
    expect(used()).toBe(1);
  });

  it("a spent roll's VALUE survives the spend, so the restore is lossless and POSITIONAL", () => {
    const { es, rolls, used } = bank(0, [7, 19]);
    es.spendFeatureRoll(PORTENT, 1);
    expect(rolls()).toEqual([7, -19]);
    expect(used()).toBe(1);                  // the 19 is spent and still readable at slot 1
    es.restoreFeatureRoll(PORTENT, 1);
    expect(rolls()).toEqual([7, 19]);
    expect(used()).toBe(0);
  });

  it("a second spend flips its OWN slot: spent slots need not be a prefix", () => {
    const { es, rolls, used } = bank(0, [3, 11, 20], 3);
    es.spendFeatureRoll(PORTENT, 1);         // the 11
    es.spendFeatureRoll(PORTENT, 2);         // the 20, in its own place
    expect(rolls()).toEqual([3, -11, -20]);
    expect(used()).toBe(2);
  });

  it("a re-roll replaces the bank live and clamps the spent count into it", () => {
    const { es, rolls, used } = bank(2, [-3, 11]);
    es.setFeatureRolls(PORTENT, [5]);
    expect(rolls()).toEqual([5]);            // a fresh bank is live by definition
    expect(used()).toBe(0);                  // never a checked box without a number
  });

  it("a box with no banked number above it cannot be spent", () => {
    const { es, rolls, used, changes } = bank(0, [7]);
    es.spendFeatureRoll(PORTENT, 1);
    expect(rolls()).toEqual([7]);
    expect(used()).toBe(0);
    expect(changes()).toBe(0);
  });

  it("a box already checked (its number already negative) cannot be spent twice", () => {
    const { es, rolls, used, changes } = bank(1, [-7, 19]);
    es.spendFeatureRoll(PORTENT, 0);
    expect(rolls()).toEqual([-7, 19]);
    expect(used()).toBe(1);
    expect(changes()).toBe(0);
  });

  it("never spends past the tracker max", () => {
    const { es, rolls, used, changes } = bank(2, [3, 11, 20], 2);
    es.spendFeatureRoll(PORTENT, 2);
    expect(rolls()).toEqual([3, 11, 20]);
    expect(used()).toBe(2);
    expect(changes()).toBe(0);
  });

  it("restoreFeatureRoll on an UNSPENT box is a no-op", () => {
    const { es, rolls, used, changes } = bank(0, [7, 19]);
    es.restoreFeatureRoll(PORTENT, 0);
    expect(rolls()).toEqual([7, 19]);
    expect(used()).toBe(0);
    expect(changes()).toBe(0);
  });

  // A hand-edited note can carry more spent uses than banked numbers. The sign is the per-slot
  // truth, so un-spending a slot with a LIVE (positive) number hands a use back the sign never
  // spent · and a slot past the bank has no number to speak for it at all.
  it("a checked box with no number behind it cannot be un-spent", () => {
    const { es, rolls, used, changes } = bank(2, [-19]);
    es.restoreFeatureRoll(PORTENT, 1);
    expect(rolls()).toEqual([-19]);
    expect(used()).toBe(2);
    expect(changes()).toBe(0);
  });

  it("an unowned resource is a no-op, the ownership rule spendFeatureUse already follows", () => {
    const c = baseChar();
    c.state.feature_rolls = { [PORTENT]: [7] };   // rolls with no tracker entry
    let changes = 0;
    const es = new CharacterEditState(c, {} as never, () => { changes += 1; });
    es.spendFeatureRoll(PORTENT, 0);
    es.restoreFeatureRoll(PORTENT, 0);
    expect(c.state.feature_rolls?.[PORTENT]).toEqual([7]);
    expect(c.state.feature_uses[PORTENT]).toBeUndefined();
    expect(changes).toBe(0);
  });
});
