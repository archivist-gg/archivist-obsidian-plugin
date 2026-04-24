/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ActionsTab } from "../src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(ds?: { successes: number; failures: number }) {
  const editState = {
    toggleDeathSaveSuccess: vi.fn(),
    toggleDeathSaveFailure: vi.fn(),
  };
  return {
    ctx: {
      derived: {},
      resolved: {
        definition: { equipment: [] },
        features: [],
        state: {
          hp: { current: 0, max: 30, temp: 0 },
          hit_dice: {},
          conditions: [],
          inspiration: 0,
          exhaustion: 0,
          death_saves: ds,
        },
      },
      editState,
    } as unknown as ComponentRenderContext,
    editState,
  };
}

describe("ActionsTab death saves (SP4)", () => {
  it("renders three success dots and three failure dots", () => {
    const root = mountContainer();
    const { ctx: c } = ctx({ successes: 1, failures: 2 });
    new ActionsTab().render(root, c);
    expect(root.querySelectorAll(".pc-death-save-success").length).toBe(3);
    expect(root.querySelectorAll(".pc-death-save-failure").length).toBe(3);
  });

  it("success dot click at index i calls toggleDeathSaveSuccess(i)", () => {
    const root = mountContainer();
    const { ctx: c, editState } = ctx({ successes: 0, failures: 0 });
    new ActionsTab().render(root, c);
    const successes = [...root.querySelectorAll<HTMLElement>(".pc-death-save-success")];
    successes[0].click();
    successes[2].click();
    expect(editState.toggleDeathSaveSuccess).toHaveBeenNthCalledWith(1, 0);
    expect(editState.toggleDeathSaveSuccess).toHaveBeenNthCalledWith(2, 2);
  });

  it("failure dot click at index i calls toggleDeathSaveFailure(i)", () => {
    const root = mountContainer();
    const { ctx: c, editState } = ctx({ successes: 0, failures: 0 });
    new ActionsTab().render(root, c);
    const failures = [...root.querySelectorAll<HTMLElement>(".pc-death-save-failure")];
    failures[1].click();
    expect(editState.toggleDeathSaveFailure).toHaveBeenCalledWith(1);
  });

  it("filled dots reflect state — successes=2 fills the first two success dots", () => {
    const root = mountContainer();
    const { ctx: c } = ctx({ successes: 2, failures: 0 });
    new ActionsTab().render(root, c);
    const successes = [...root.querySelectorAll<HTMLElement>(".pc-death-save-success")];
    expect(successes[0].classList.contains("filled")).toBe(true);
    expect(successes[1].classList.contains("filled")).toBe(true);
    expect(successes[2].classList.contains("filled")).toBe(false);
  });
});
