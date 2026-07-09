// tests/pc-rest.test.ts
import { describe, it, expect } from "vitest";
import { computeRestPlan } from "@archivist-gg/dnd5e/pc/pc.rest";
import { applyRestResets } from "../packages/obsidian/src/modules/pc/pc.rest";
import {
  FIGHTER_5_CLERIC_3, WIZARD_5_WOUNDED, BARBARIAN_6_EXHAUSTED,
  clone, fakeResolved, fakeDerived,
} from "./fixtures/pc/rest-fixtures";
import { MONK_6_DRAINED, PC_WITH_MAGIC_ITEMS, PC_AT_ZERO_HP } from "./fixtures/pc/rest-fixtures";

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

describe("computeRestPlan — short rest", () => {
  it("includes feature_uses with reset 'short-rest'", () => {
    const c = clone(MONK_6_DRAINED);
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "short");
    expect(plan.categories.find((x) => x.id === "feature:ki")).toBeDefined();
  });

  it("excludes feature_uses with reset 'long-rest' on short rest", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED);
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "rage", name: "Rage", resources: [{ id: "rage", reset: "long-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "short");
    expect(plan.categories.find((x) => x.id === "feature:rage")).toBeUndefined();
  });

  it("includes item charges with reset 'short' only (not 'long' or 'dawn')", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    expect(plan.categories.find((x) => x.id === "item:0")).toBeDefined(); // bag-of-tricks: short ✓
    expect(plan.categories.find((x) => x.id === "item:1")).toBeUndefined(); // cloak: dawn ✗
  });

  it("omits HP / exhaustion / spell-slots / hd-regain categories on short rest", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    for (const id of ["hp-to-max", "exhaustion", "spell-slots", "hd-regain"]) {
      expect(plan.categories.find((x) => x.id === id)).toBeUndefined();
    }
  });

  it("populates hdAvailable with pools that have remaining dice", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    expect(plan.hdAvailable).toEqual([
      { die: "d10", remaining: 2 }, // 5 - 3
      { die: "d8",  remaining: 1 }, // 3 - 2
    ]);
  });

  it("hdAvailable excludes pools with 0 remaining", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.hit_dice.d10 = { used: 5, total: 5 };
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    expect(plan.hdAvailable.find((p) => p.die === "d10")).toBeUndefined();
  });

  it("hdAvailable is empty for long rest", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(plan.hdAvailable).toEqual([]);
  });
});

describe("applyRestResets — long rest mutations", () => {
  it("sets hp.current to derived.hp.max", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.hp.current).toBe(32);
  });

  it("clears death_saves when waking from 0 HP", () => {
    const c = clone(PC_AT_ZERO_HP);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("decrements exhaustion by 1", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.exhaustion).toBe(2);
  });

  it("exhaustion floors at 0", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.exhaustion = 0;
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.exhaustion).toBe(0);
  });

  it("resets all spell_slots to used=0", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    for (const slot of Object.values(c.state.spell_slots)) {
      expect(slot.used).toBe(0);
    }
  });

  it("clears concentration unconditionally (no opt-out)", () => {
    const c = clone(FIGHTER_5_CLERIC_3); // concentration: '[[bless]]'
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.concentration).toBeNull();
  });

  it("distributes hd-regain most-spent-first", () => {
    const c = clone(FIGHTER_5_CLERIC_3); // totalLevel 8 → regain 4; d10:3, d8:2
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.hit_dice.d10.used).toBe(0); // -3
    expect(c.state.hit_dice.d8.used).toBe(1);  // -1
  });

  it("restores feature_uses with reset short OR long", () => {
    const c = clone(MONK_6_DRAINED);
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "long");
    applyRestResets(c, resolved, fakeDerived(c), plan, new Set());
    expect(c.state.feature_uses.ki.used).toBe(0);
  });

  it("restores item charges with reset in {short, long, dawn}", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.equipment[0].state!.charges!.current).toBe(3); // bag-of-tricks
    expect(c.equipment[1].state!.charges!.current).toBe(1); // cloak (dawn)
  });

  it("opt-out of hp-to-max preserves current HP", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set(["hp-to-max"]));
    expect(c.state.hp.current).toBe(12);
  });

  it("opt-out of exhaustion preserves exhaustion level", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set(["exhaustion"]));
    expect(c.state.exhaustion).toBe(3);
  });

  it("with all categories opted out, only concentration changes", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    const allIds = new Set(plan.categories.map((cat) => cat.id));
    const before = clone(c.state);
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, allIds);
    expect(c.state.concentration).toBeNull(); // unconditional
    expect(c.state.hp).toEqual(before.hp);
    expect(c.state.exhaustion).toBe(before.exhaustion);
    expect(c.state.spell_slots).toEqual(before.spell_slots);
  });
});

describe("applyRestResets — short rest + edge cases", () => {
  it("short rest restores only short-rest features", () => {
    const c = clone(MONK_6_DRAINED);
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "short");
    applyRestResets(c, resolved, fakeDerived(c), plan, new Set());
    expect(c.state.feature_uses.ki.used).toBe(0);
  });

  it("short rest does not clear concentration", () => {
    const c = clone(FIGHTER_5_CLERIC_3); // concentration: '[[bless]]'
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set());
    expect(c.state.concentration).toBe("[[bless]]");
  });

  it("short rest leaves long-rest features untouched", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED);
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "rage", name: "Rage", resources: [{ id: "rage", reset: "long-rest" }] }, source: null }],
    });
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "short");
    applyRestResets(c, resolved, fakeDerived(c), plan, new Set());
    expect(c.state.feature_uses.rage.used).toBe(3);
  });

  it("is idempotent — applying twice equals applying once", () => {
    const a = clone(WIZARD_5_WOUNDED);
    const b = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(a, fakeResolved(a), fakeDerived(a), null, "long");
    applyRestResets(a, fakeResolved(a), fakeDerived(a), plan, new Set());
    applyRestResets(b, fakeResolved(b), fakeDerived(b), plan, new Set());
    applyRestResets(b, fakeResolved(b), fakeDerived(b), plan, new Set()); // twice
    expect(a.state).toEqual(b.state);
  });

  it("optouts referencing a missing category id are ignored", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long");
    expect(() => {
      applyRestResets(c, fakeResolved(c), fakeDerived(c), plan, new Set(["item:99" as never]));
    }).not.toThrow();
    expect(c.state.hp.current).toBe(32); // long rest still applied
  });

  it("computeRestPlan does not throw on unknown reset value", () => {
    const c = clone(MONK_6_DRAINED);
    const resolved = fakeResolved(c, {
      features: [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "weird-cadence" }] }, source: null }],
    });
    expect(() => computeRestPlan(c, resolved, fakeDerived(c), null, "long")).not.toThrow();
    const plan = computeRestPlan(c, resolved, fakeDerived(c), null, "long");
    expect(plan.categories.find((x) => x.id === "feature:ki")).toBeUndefined();
  });

  it("computeRestPlan tolerates missing state.exhaustion", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    delete (c.state as Partial<typeof c.state>).exhaustion;
    expect(() => computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "long")).not.toThrow();
  });

  it("computeRestPlan tolerates empty hit_dice", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.hit_dice = {};
    const plan = computeRestPlan(c, fakeResolved(c), fakeDerived(c), null, "short");
    expect(plan.hdAvailable).toEqual([]);
  });
});
