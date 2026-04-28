/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderChargeBoxes } from "../src/modules/pc/components/actions/charge-boxes";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderChargeBoxes", () => {
  it("renders N total boxes; (max - used) are empty (available), 'used' have .expended", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 3, max: 7, recovery: { amount: "1d6+1", reset: "dawn" } });
    const boxes = root.querySelectorAll(".pc-charge-box");
    expect(boxes.length).toBe(7);
    const expended = root.querySelectorAll(".pc-charge-box.expended");
    expect(expended.length).toBe(3);
  });

  it("clicking an empty box calls onExpend", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 0, max: 3, onExpend, onRestore });
    const firstEmpty = root.querySelector(".pc-charge-box:not(.expended)") as HTMLElement;
    firstEmpty.click();
    expect(onExpend).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("clicking an expended box calls onRestore", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 2, max: 3, onExpend, onRestore });
    const firstExpended = root.querySelector(".pc-charge-box.expended") as HTMLElement;
    firstExpended.click();
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onExpend).not.toHaveBeenCalled();
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
