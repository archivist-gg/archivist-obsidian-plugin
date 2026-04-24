/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { StatsTiles } from "../src/modules/pc/components/stats-tiles";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(over: Partial<{ prof: number; init: number; speed: number; insp: number }> = {}): ComponentRenderContext {
  return {
    derived: {
      proficiencyBonus: over.prof ?? 5,
      initiative: over.init ?? 2,
      speed: over.speed ?? 30,
    },
    resolved: { state: { inspiration: over.insp ?? 2 } },
  } as unknown as ComponentRenderContext;
}

describe("StatsTiles", () => {
  it("renders 4 tiles: PROFICIENCY / INITIATIVE / SPEED / INSPIRATION", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx());
    const tiles = [...root.querySelectorAll(".pc-stats-tile")];
    expect(tiles.length).toBe(4);
    const labels = tiles.map((t) => t.querySelector(".pc-stats-tile-lbl")?.textContent);
    expect(labels).toEqual(["PROFICIENCY", "INITIATIVE", "SPEED", "INSPIRATION"]);
  });

  it("shows +5 / +2 / 30ft / 2 for given stats", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx({ prof: 5, init: 2, speed: 30, insp: 2 }));
    expect(root.querySelector(".pc-stats-tile[data-stat='prof'] .pc-stats-tile-val")?.textContent).toBe("+5");
    expect(root.querySelector(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")?.textContent).toBe("+2");
    expect(root.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-val")?.textContent).toBe("30ft");
    expect(root.querySelector(".pc-stats-tile[data-stat='insp'] .pc-stats-tile-ct")?.textContent).toBe("2");
  });

  it("INSPIRATION tile has − and + buttons inline with the count", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx());
    const insp = root.querySelector(".pc-stats-tile[data-stat='insp']");
    expect(insp?.querySelector("button.pc-insp-minus")?.textContent).toBe("−");
    expect(insp?.querySelector("button.pc-insp-plus")?.textContent).toBe("+");
  });

  it("each tile has the shared .pc-panel class (hairline border)", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx());
    expect(root.querySelectorAll(".pc-panel.pc-stats-tile").length).toBe(4);
  });
});

describe("StatsTiles — interactive inspiration (SP4)", () => {
  function interactiveCtx(inspiration: number) {
    const editState = { setInspiration: vi.fn() };
    return {
      ctx: {
        derived: { proficiencyBonus: 2, initiative: 0, speed: 30 },
        resolved: { state: { inspiration } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("− click calls setInspiration(current - 1)", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx(3);
    new StatsTiles().render(root, ctx);
    root.querySelector<HTMLButtonElement>(".pc-insp-minus")!.click();
    expect(editState.setInspiration).toHaveBeenCalledWith(2);
  });

  it("+ click calls setInspiration(current + 1)", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx(3);
    new StatsTiles().render(root, ctx);
    root.querySelector<HTMLButtonElement>(".pc-insp-plus")!.click();
    expect(editState.setInspiration).toHaveBeenCalledWith(4);
  });

  it("clicking − at 0 calls setInspiration(-1) — edit state floors to 0", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx(0);
    new StatsTiles().render(root, ctx);
    root.querySelector<HTMLButtonElement>(".pc-insp-minus")!.click();
    expect(editState.setInspiration).toHaveBeenCalledWith(-1);
  });
});
