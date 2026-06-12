/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { clampDx } from "../src/modules/pc/components/builder/popover-clamp";

describe("clampDx — horizontal popover clamp math", () => {
  it("returns 0 when the panel fits within bounds", () => {
    expect(clampDx(100, 300, 0, 800)).toBe(0);
  });
  it("shifts left when the panel overflows the right bound (8px margin)", () => {
    // panel [700, 898] in bounds [0, 800] → right edge must land at 792
    expect(clampDx(700, 898, 0, 800)).toBe(-106);
  });
  it("shifts right when the panel overflows the left bound", () => {
    expect(clampDx(-30, 168, 0, 800)).toBe(38);
  });
  it("prefers the left edge when the bounds are narrower than the panel", () => {
    expect(clampDx(0, 198, 0, 100)).toBe(8);
  });
});
