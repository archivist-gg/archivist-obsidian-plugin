// tests/pc-rest.test.ts
import { describe, it, expect } from "vitest";
import { computeRestPlan } from "../src/modules/pc/pc.rest";
import {
  FIGHTER_5_CLERIC_3, WIZARD_5_WOUNDED, BARBARIAN_6_EXHAUSTED,
  clone, fakeResolved, fakeDerived,
} from "./fixtures/pc/rest-fixtures";

describe("computeRestPlan — long rest — HP / exhaustion / spell slots", () => {
  it("includes hp-to-max when hp.current < derived.hp.max", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    const hp = plan.categories.find((cat) => cat.id === "hp-to-max");
    expect(hp).toBeDefined();
    expect(hp!.preview).toBe("12 → 32");
  });

  it("omits hp-to-max when hp is at max", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.hp.current = c.state.hp.max;
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "hp-to-max")).toBeUndefined();
  });

  it("includes exhaustion when > 0", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    const ex = plan.categories.find((cat) => cat.id === "exhaustion");
    expect(ex).toBeDefined();
    expect(ex!.preview).toBe("3 → 2");
  });

  it("omits exhaustion when 0", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "exhaustion")).toBeUndefined();
  });

  it("includes spell-slots when any slot is used", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "spell-slots")).toBeDefined();
  });

  it("omits spell-slots when all slots are full", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.spell_slots = { 1: { used: 0, total: 4 } };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "spell-slots")).toBeUndefined();
  });
});
