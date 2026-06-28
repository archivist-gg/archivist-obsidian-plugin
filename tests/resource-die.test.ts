import { describe, it, expect } from "vitest";
import { resolveScalingDie } from "../packages/obsidian/src/shared/dnd/resource-die";

describe("resolveScalingDie", () => {
  it("returns base below the first scaling threshold", () => {
    expect(resolveScalingDie({ base: "d6", scaling: { "5": "d8", "11": "d10" } }, 4)).toBe("d6");
  });
  it("returns the highest threshold ≤ level", () => {
    const die = { base: "d6", scaling: { "5": "d8", "11": "d10", "17": "d12" } };
    expect(resolveScalingDie(die, 5)).toBe("d8");
    expect(resolveScalingDie(die, 10)).toBe("d8");
    expect(resolveScalingDie(die, 11)).toBe("d10");
    expect(resolveScalingDie(die, 20)).toBe("d12");
  });
  it("returns base when there is no scaling map", () => {
    expect(resolveScalingDie({ base: "d8" }, 20)).toBe("d8");
  });
  it("returns base for an empty scaling object", () => {
    expect(resolveScalingDie({ base: "d6", scaling: {} }, 20)).toBe("d6");
  });
  it("skips non-numeric scaling keys (NaN coercion)", () => {
    expect(resolveScalingDie({ base: "d6", scaling: { "5": "d8", "foo": "d12" } }, 20)).toBe("d8");
  });
});
