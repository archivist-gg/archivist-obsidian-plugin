/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderChargesWidget } from "../src/modules/pc/components/charges-widget";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderChargesWidget", () => {
  it("renders current/max", () => {
    const root = document.createElement("div");
    renderChargesWidget(root, { current: 5, max: 7, recovery: "1d6+1 at dawn", onSetCurrent: vi.fn() });
    expect(root.querySelector(".pc-charges-current")?.textContent).toBe("5");
    expect(root.querySelector(".pc-charges-max")?.textContent).toBe("7");
    expect(root.querySelector(".pc-charges-recovery")?.textContent).toMatch(/1d6\+1 at dawn/);
  });

  it("clicking current → input → Enter commits clamped value", () => {
    const root = document.createElement("div");
    const onSet = vi.fn();
    renderChargesWidget(root, { current: 5, max: 7, onSetCurrent: onSet });
    (root.querySelector(".pc-charges-current") as HTMLElement).click();
    const input = root.querySelector("input")!;
    input.value = "99";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSet).toHaveBeenCalledWith(7);
  });

  it("hides recovery line when omitted", () => {
    const root = document.createElement("div");
    renderChargesWidget(root, { current: 1, max: 3, onSetCurrent: vi.fn() });
    expect(root.querySelector(".pc-charges-recovery")).toBeNull();
  });
});
