/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { openConditionsPopover, closeConditionsPopover } from "../src/modules/pc/components/conditions-popover";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

afterEach(() => {
  closeConditionsPopover();
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

function ctxWith(conditions: string[] = [], exhaustion = 0) {
  const editState = {
    toggleCondition: vi.fn(),
    setExhaustion: vi.fn(),
  };
  return {
    ctx: {
      derived: {},
      resolved: { state: { conditions, exhaustion } },
      editState,
    } as unknown as ComponentRenderContext,
    editState,
  };
}

describe("conditions-popover", () => {
  it("opens attached to document.body", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith();
    openConditionsPopover(anchor, ctx);
    expect(document.body.querySelector(".pc-cond-popover")).not.toBeNull();
  });

  it("renders 14 condition rows with toggles", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith();
    openConditionsPopover(anchor, ctx);
    const rows = document.body.querySelectorAll(".pc-cond-popover-row");
    expect(rows.length).toBe(14);
    expect(document.body.querySelectorAll(".pc-cond-toggle").length).toBe(14);
  });

  it("toggle click calls editState.toggleCondition with the slug", () => {
    const anchor = mountContainer();
    const { ctx, editState } = ctxWith();
    openConditionsPopover(anchor, ctx);
    const blinded = document.body.querySelector<HTMLElement>(".pc-cond-popover-row[data-slug='blinded'] .pc-cond-toggle")!;
    blinded.click();
    expect(editState.toggleCondition).toHaveBeenCalledWith("blinded");
  });

  it("renders 7 exhaustion pills labeled -- 1 2 3 4 5 6", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith([], 0);
    openConditionsPopover(anchor, ctx);
    const pills = [...document.body.querySelectorAll<HTMLElement>(".pc-cond-exhaustion-pill")];
    expect(pills.length).toBe(7);
    expect(pills.map((p) => p.textContent?.trim())).toEqual(["--", "1", "2", "3", "4", "5", "6"]);
  });

  it("pill click calls setExhaustion with the pill's level (-- = 0)", () => {
    const anchor = mountContainer();
    const { ctx, editState } = ctxWith();
    openConditionsPopover(anchor, ctx);
    const pills = [...document.body.querySelectorAll<HTMLElement>(".pc-cond-exhaustion-pill")];
    pills[0].click();  // --
    pills[4].click();  // 4
    expect(editState.setExhaustion).toHaveBeenNthCalledWith(1, 0);
    expect(editState.setExhaustion).toHaveBeenNthCalledWith(2, 4);
  });

  it("active pill reflects current exhaustion level", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith([], 3);
    openConditionsPopover(anchor, ctx);
    const active = document.body.querySelector<HTMLElement>(".pc-cond-exhaustion-pill.active");
    expect(active?.textContent?.trim()).toBe("3");
  });

  it("Escape key closes the popover", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith();
    openConditionsPopover(anchor, ctx);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.querySelector(".pc-cond-popover")).toBeNull();
  });

  it("click outside closes the popover", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith();
    openConditionsPopover(anchor, ctx);
    document.body.click();  // outside anchor, outside popover
    expect(document.body.querySelector(".pc-cond-popover")).toBeNull();
  });

  it("re-opening replaces any existing popover", () => {
    const anchor = mountContainer();
    const { ctx } = ctxWith();
    openConditionsPopover(anchor, ctx);
    openConditionsPopover(anchor, ctx);
    expect(document.body.querySelectorAll(".pc-cond-popover").length).toBe(1);
  });
});
