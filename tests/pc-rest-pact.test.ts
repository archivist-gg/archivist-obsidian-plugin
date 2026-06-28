import { describe, it, expect } from "vitest";
import { computeRestPlan, applyRestResets } from "../packages/obsidian/src/modules/pc/pc.rest";
import { clone, fakeResolved, fakeDerived } from "./fixtures/pc/rest-fixtures";
import type { Character } from "../packages/obsidian/src/modules/pc/pc.types";

function warlock(usedPact: number): Character {
  return {
    name: "Lock", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "[[warlock]]", level: 5, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 16 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {},
    state: { hp: { current: 30, max: 30, temp: 0 }, hit_dice: {}, spell_slots: {}, spell_slots_pact: { level: 3, used: usedPact, total: 2 }, concentration: null, conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  };
}

describe("rest — pact magic", () => {
  it("short rest offers + resets pact slots", () => {
    const c = clone(warlock(2));
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    expect(plan.categories.some((cat) => cat.id === "pact-slots")).toBe(true);
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.spell_slots_pact!.used).toBe(0);
  });

  it("long rest also resets pact slots", () => {
    const c = clone(warlock(1));
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.some((cat) => cat.id === "pact-slots")).toBe(true);
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.spell_slots_pact!.used).toBe(0);
  });

  it("no pact category when there are no pact slots", () => {
    const c = clone(warlock(0));
    c.state.spell_slots_pact = undefined;
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    expect(plan.categories.some((cat) => cat.id === "pact-slots")).toBe(false);
  });
});
