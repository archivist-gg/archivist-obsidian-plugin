import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import {
  FIGHTER_5_CLERIC_3, WIZARD_5_WOUNDED, BARBARIAN_6_EXHAUSTED, MONK_6_DRAINED,
  clone, fakeResolved, fakeDerived,
} from "./fixtures/pc/rest-fixtures";

function makeState(character: ReturnType<typeof clone<typeof FIGHTER_5_CLERIC_3>>, features: unknown[] = []) {
  const resolved = fakeResolved(character, { features: features as never });
  const derived = fakeDerived(character);
  const onChange = vi.fn();
  const es = new CharacterEditState(character, () => ({ resolved, derived }), onChange);
  return { es, character, onChange };
}

describe("CharacterEditState.longRest", () => {
  it("applies long-rest plan and fires onChange once", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const { es, onChange } = makeState(c);
    es.longRest(new Set());
    expect(c.state.hp.current).toBe(32);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("respects optouts", () => {
    const c = clone(WIZARD_5_WOUNDED);
    const { es } = makeState(c);
    es.longRest(new Set(["hp-to-max"]));
    expect(c.state.hp.current).toBe(12);
  });

  it("clears concentration unconditionally", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const { es } = makeState(c);
    es.longRest(new Set());
    expect(c.state.concentration).toBeNull();
  });

  it("long rest clears the HP modifier (kept row), guard-safe", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const { es } = makeState(c);
    es.setHpModifier(-5);
    es.longRest(new Set());
    expect(c.overrides.hp?.modifier).toBeUndefined();
  });

  it("opt-out keeps the modifier", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const { es } = makeState(c);
    es.setHpModifier(-5);
    es.longRest(new Set(["hp-modifier-reset"]));
    expect(c.overrides.hp?.modifier).toBe(-5);
  });

  it("clear keeps sibling override key", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const { es } = makeState(c);
    es.setMaxHpOverride(40); es.setHpModifier(3);
    es.longRest(new Set());
    expect(c.overrides.hp).toEqual({ max: 40 });
  });
});

describe("CharacterEditState.shortRest", () => {
  it("applies short-rest plan and fires onChange once", () => {
    const c = clone(MONK_6_DRAINED);
    const features = [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }];
    const { es, onChange } = makeState(c, features);
    es.shortRest(new Set());
    expect(c.state.feature_uses.ki.used).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not clear concentration", () => {
    const c = clone(FIGHTER_5_CLERIC_3);
    const { es } = makeState(c);
    es.shortRest(new Set());
    expect(c.state.concentration).toBe("[[bless]]");
  });

  it("does not restore long-rest features", () => {
    const c = clone(BARBARIAN_6_EXHAUSTED);
    const features = [{ feature: { id: "rage", name: "Rage", resources: [{ id: "rage", reset: "long-rest" }] }, source: null }];
    const { es } = makeState(c, features);
    es.shortRest(new Set());
    expect(c.state.feature_uses.rage.used).toBe(3);
  });
});

/** G8: the bank clears in the SAME `feature:<key>` category as the uses, so ONE opt-out governs both
 *  (brief §Design; the dnd5e `computeRestPlan` loops fire on spent uses OR banked rolls). */
describe("CharacterEditState rest — banked rolls (G8)", () => {
  const PORTENT = "wizard-2024:foretelling-roll";

  function portent(reset: string) {
    return [{ feature: { id: "portent", name: "Portent", resources: [{ id: PORTENT, reset }] }, source: null }];
  }

  function banked(used: number, rolls: number[]) {
    const c = clone(FIGHTER_5_CLERIC_3);
    c.state.feature_uses[PORTENT] = { used, max: 2 };
    if (rolls.length > 0) c.state.feature_rolls = { [PORTENT]: rolls };
    return c;
  }

  it("a long rest clears the bank together with the uses", () => {
    const c = banked(1, [19, 7]);
    const { es } = makeState(c, portent("long-rest"));
    es.longRest(new Set());
    expect(c.state.feature_uses[PORTENT].used).toBe(0);
    expect(c.state.feature_rolls?.[PORTENT]).toBeUndefined();
  });

  it("the mid-day shape with NOTHING spent still loses its rolls", () => {
    const c = banked(0, [19, 7]);
    const { es } = makeState(c, portent("long-rest"));
    es.longRest(new Set());
    expect(c.state.feature_rolls?.[PORTENT]).toBeUndefined();
  });

  it("one opt-out governs both axes: the rolls stay when the category is skipped", () => {
    const c = banked(1, [19, 7]);
    const { es } = makeState(c, portent("long-rest"));
    es.longRest(new Set([`feature:${PORTENT}`]));
    expect(c.state.feature_uses[PORTENT].used).toBe(1);
    expect(c.state.feature_rolls?.[PORTENT]).toEqual([19, 7]);
  });

  it("a short-rest bank clears on a short rest", () => {
    const c = banked(1, [4]);
    const { es } = makeState(c, portent("short-rest"));
    es.shortRest(new Set());
    expect(c.state.feature_uses[PORTENT].used).toBe(0);
    expect(c.state.feature_rolls?.[PORTENT]).toBeUndefined();
  });

  it("a long-rest bank survives a short rest", () => {
    const c = banked(1, [19, 7]);
    const { es } = makeState(c, portent("long-rest"));
    es.shortRest(new Set());
    expect(c.state.feature_uses[PORTENT].used).toBe(1);
    expect(c.state.feature_rolls?.[PORTENT]).toEqual([19, 7]);
  });

  it("a rest on a resource with NO bank leaves no feature_rolls residue", () => {
    const c = banked(1, []);
    const { es } = makeState(c, portent("long-rest"));
    es.longRest(new Set());
    expect(c.state.feature_uses[PORTENT].used).toBe(0);
    expect(c.state.feature_rolls).toBeUndefined();
  });
});
