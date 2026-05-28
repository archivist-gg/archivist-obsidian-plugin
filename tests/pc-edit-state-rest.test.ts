import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
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
