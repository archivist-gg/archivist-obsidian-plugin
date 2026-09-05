/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderPointPool } from "../packages/obsidian/src/modules/pc/components/actions/point-pool";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderPointPool (R4-G4 §5.2.1)", () => {
  it("renders 'N / M <name>' with steppers, no toggle boxes", () => {
    const root = mountContainer();
    renderPointPool(root, { id: "paladin:lay-on-hands", name: "Lay on Hands", used: 5, max: 25, resetLabel: "Long Rest", onSet: () => {} });
    expect(root.querySelector(".pc-point-pool-value")!.textContent).toBe("20 / 25");
    expect(root.querySelector(".pc-point-pool-name")!.textContent).toBe("Lay on Hands");
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.querySelector(".pc-point-pool-reset")!.textContent).toBe("Long Rest");
  });

  it("− spends one (used + 1), + restores one (used − 1), both clamped to [0, max]", () => {
    const root = mountContainer();
    const onSet = vi.fn();
    renderPointPool(root, { id: "x", name: "X", used: 0, max: 3, onSet });
    // m12's RED FIRST (Gate 2 M-4): the clamp is the first assertion; the unclamped mutant reports -1 here
    root.querySelector<HTMLElement>(".pc-point-pool-plus")!.click();
    expect(onSet).toHaveBeenLastCalledWith(0);   // clamped: never below 0
    root.querySelector<HTMLElement>(".pc-point-pool-minus")!.click();
    expect(onSet).toHaveBeenLastCalledWith(1);
    const full = mountContainer();
    const onSet2 = vi.fn();
    renderPointPool(full, { id: "y", name: "Y", used: 3, max: 3, onSet: onSet2 });
    full.querySelector<HTMLElement>(".pc-point-pool-minus")!.click();
    expect(onSet2).toHaveBeenLastCalledWith(3);  // clamped: never above max
  });
});
