// tests/pc-rest.test.ts
import { describe, it, expect } from "vitest";
import { computeRestPlan } from "../src/modules/pc/pc.rest";
import {
  FIGHTER_5_CLERIC_3, WIZARD_5_WOUNDED, BARBARIAN_6_EXHAUSTED,
  clone, fakeResolved, fakeDerived,
} from "./fixtures/pc/rest-fixtures";
import { MONK_6_DRAINED, PC_WITH_MAGIC_ITEMS } from "./fixtures/pc/rest-fixtures";

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

describe("computeRestPlan — long rest — HD regain", () => {
  it("includes hd-regain when any pool has used > 0", () => {
    const c = clone(FIGHTER_5_CLERIC_3); // d10 used:3/5, d8 used:2/3, totalLevel 8 → regain 4
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    const hd = plan.categories.find((cat) => cat.id === "hd-regain");
    expect(hd).toBeDefined();
    expect(hd!.preview).toBe("+4 (d10: +3, d8: +1)");
  });

  it("regain math floors at 1 even at level 1", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.class = [{ name: "[[fighter]]", level: 1, subclass: null, choices: {} }];
    c.state.hit_dice = { d10: { used: 1, total: 1 } };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "hd-regain")!.preview).toBe("+1 (d10: +1)");
  });

  it("omits hd-regain when all pools are full", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.hit_dice = {
      d10: { used: 0, total: 5 },
      d8:  { used: 0, total: 3 },
    };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "hd-regain")).toBeUndefined();
  });

  it("distribution fills the most-spent pool first", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    // totalLevel 8 → regain 4; d10:used 4/5, d8:used 1/3
    c.state.hit_dice = {
      d10: { used: 4, total: 5 },
      d8:  { used: 1, total: 3 },
    };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "hd-regain")!.preview).toBe("+4 (d10: +4)");
  });

  it("caps distribution at total used (never over-restores)", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    // totalLevel 8 → regain 4; only 2 used total
    c.state.hit_dice = {
      d10: { used: 1, total: 5 },
      d8:  { used: 1, total: 3 },
    };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((cat) => cat.id === "hd-regain")!.preview).toBe("+2 (d10: +1, d8: +1)");
  });
});

describe("computeRestPlan — long rest — feature_uses + item charges", () => {
  it("includes feature_uses with reset 'long-rest'", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED); // rage used 3/3, reset long
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "rage", name: "Rage", resources: [{ id: "rage", reset: "long-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "long");
    const cat = plan.categories.find((x) => x.id === "feature:rage");
    expect(cat).toBeDefined();
    expect(cat!.label).toBe("Rage");
    expect(cat!.preview).toBe("3/3 restored");
  });

  it("includes feature_uses with reset 'short-rest' on long rest (long includes short)", () => {
    const c = clone(MONK_6_DRAINED); // ki used 6/6, reset short
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "long");
    expect(plan.categories.find((x) => x.id === "feature:ki")).toBeDefined();
  });

  it("omits feature_uses with used === 0", () => {
    const c = clone(MONK_6_DRAINED);
    c.state.feature_uses.ki.used = 0;
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "long");
    expect(plan.categories.find((x) => x.id === "feature:ki")).toBeUndefined();
  });

  it("includes item charges with reset in {short, long, dawn} when partially used", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    // bag-of-tricks reset:short, cloak reset:dawn — both included on long rest
    expect(plan.categories.find((x) => x.id === "item:0")).toBeDefined();
    expect(plan.categories.find((x) => x.id === "item:1")).toBeDefined();
  });

  it("falls back to entry.item slug when no registry provided", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    const itemCat = plan.categories.find((x) => x.id === "item:0");
    expect(itemCat!.label).toBe("[[bag-of-tricks]]");
  });

  it("uses entry.overrides.name when present", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    c.equipment[0].overrides = { name: "My Tricky Bag" };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((x) => x.id === "item:0")!.label).toBe("My Tricky Bag");
  });

  it("omits item charges that are already full", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    c.equipment[0].state!.charges = { current: 3, max: 3 };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.categories.find((x) => x.id === "item:0")).toBeUndefined();
  });
});
