/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderChargeBoxes } from "../packages/obsidian/src/modules/pc/components/actions/charge-boxes";
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

  // R4-G3a §8.2 (viii): `recovery` is a discriminated shape. The FEATURE path
  // passes a caption STRING built from `RESET_LABELS`; the ITEM path keeps the
  // persisted `dawn|short|long|special` vocabulary and its own four-member map
  // (invariant 4 · the item enum is untouched on both the persist and the
  // display side).
  it("renders the caption-STRING form verbatim (the feature path)", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "1", label: "Short or Long Rest" } });
    expect(root.querySelector(".pc-charge-recovery")?.textContent).toBe("/ Short or Long Rest");
  });

  it("still reads the ITEM four-member map on the `reset` form", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "1", reset: "dawn" } });
    expect(root.querySelector(".pc-charge-recovery")?.textContent).toBe("/ Dawn");
  });

  it("hangs `recoveryTitle` on the caption as a title attribute (the `custom` tooltip)", () => {
    const root = mountContainer();
    renderChargeBoxes(root, {
      used: 0, max: 1,
      recovery: { amount: "1", label: "Special" },
      recoveryTitle: "Recovery is described in this feature's text",
    });
    const rec = root.querySelector(".pc-charge-recovery");
    expect(rec?.textContent).toBe("/ Special");
    expect(rec?.getAttribute("title")).toBe("Recovery is described in this feature's text");
  });

  it("sets NO title attribute when `recoveryTitle` is absent", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "1", label: "Short Rest" } });
    expect(root.querySelector(".pc-charge-recovery")?.getAttribute("title")).toBeNull();
  });
});

describe("R4-G4 §5.2.2 · the ceiling and the at-will sentinel", () => {
  it("RED FIRST: max 25 with a renderLarge routes to it and draws no boxes", () => {
    const root = mountContainer();
    const large = vi.fn((parent: HTMLElement) => parent.createDiv({ cls: "large-stub" }));
    renderChargeBoxes(root, { used: 0, max: 25, renderLarge: large });
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(large).toHaveBeenCalledTimes(1);
  });

  it("max 12 (the boundary) still draws 12 boxes", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 12, renderLarge: (p) => p.createDiv({ cls: "large-stub" }) });
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(12);
  });

  it("RED FIRST: atWill renders the text and no boxes, even with a renderLarge", () => {
    const root = mountContainer();
    const large = vi.fn((parent: HTMLElement) => parent.createDiv({ cls: "large-stub" }));
    renderChargeBoxes(root, { used: 0, max: 999, atWill: true, renderLarge: large });
    expect(root.querySelector(".pc-charge-at-will")!.textContent).toBe("at will");
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(large).not.toHaveBeenCalled();
  });

  it("without a renderLarge the boxes are drawn whatever the max (the spell-slot / item / race sites)", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 20 });
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(20);
  });
});
