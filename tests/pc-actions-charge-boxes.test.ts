/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderChargeBoxes } from "../src/modules/pc/components/actions/charge-boxes";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderChargeBoxes", () => {
  it("renders N total boxes; 'used' have .archivist-toggle-box-checked", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 3, max: 7, recovery: { amount: "1d6+1", reset: "dawn" } });
    const boxes = root.querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(7);
    const checked = root.querySelectorAll(".archivist-toggle-box-checked");
    expect(checked.length).toBe(3);
  });

  it("clicking an unchecked box at index 2 fills 0..2 (newUsed = 3) via onSet", () => {
    const root = mountContainer();
    const onSet = vi.fn();
    renderChargeBoxes(root, { used: 0, max: 5, onSet });
    const boxes = root.querySelectorAll<HTMLElement>(".archivist-toggle-box");
    boxes[2].click();
    expect(onSet).toHaveBeenCalledWith(3);
    // visual update applied immediately
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(3);
  });

  it("clicking a checked box decrements (newUsed = currentUsed - 1) via onSet", () => {
    const root = mountContainer();
    const onSet = vi.fn();
    renderChargeBoxes(root, { used: 3, max: 5, onSet });
    const checked = root.querySelectorAll<HTMLElement>(".archivist-toggle-box-checked");
    checked[1].click(); // any checked box → decrement
    expect(onSet).toHaveBeenCalledWith(2);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(2);
  });

  it("falls back to onExpend when onSet absent and click increases used", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 0, max: 3, onExpend, onRestore });
    const firstEmpty = root.querySelector<HTMLElement>(".archivist-toggle-box:not(.archivist-toggle-box-checked)")!;
    firstEmpty.click(); // newUsed=1, diff=+1 → onExpend × 1
    expect(onExpend).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("falls back to onRestore when onSet absent and click decreases used", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 2, max: 3, onExpend, onRestore });
    const firstChecked = root.querySelector<HTMLElement>(".archivist-toggle-box-checked")!;
    firstChecked.click(); // newUsed=1, diff=-1 → onRestore × 1
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onExpend).not.toHaveBeenCalled();
  });

  it("fallback emits multiple events when click jumps multiple pips", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 0, max: 5, onExpend, onRestore });
    const boxes = root.querySelectorAll<HTMLElement>(".archivist-toggle-box");
    boxes[2].click(); // 0 → 3 used → onExpend × 3
    expect(onExpend).toHaveBeenCalledTimes(3);
  });

  it("renders recovery suffix when provided", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "1", reset: "long" } });
    const rec = root.querySelector(".pc-charge-recovery");
    expect(rec?.textContent).toMatch(/long rest/i);
  });

  it("formats recovery 'special' as 'Special'", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "0", reset: "special" } });
    expect(root.querySelector(".pc-charge-recovery")?.textContent?.toLowerCase()).toContain("special");
  });
});
