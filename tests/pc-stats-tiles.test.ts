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

describe("StatsTiles — interactive overrides (SP4c)", () => {
  function ctxWithOverride(opts: {
    speed?: number;
    init?: number;
    overrides?: { speed?: number; initiative?: number };
  } = {}): { ctx: ComponentRenderContext; editState: { setSpeedOverride: ReturnType<typeof vi.fn>; clearSpeedOverride: ReturnType<typeof vi.fn>; setInitiativeOverride: ReturnType<typeof vi.fn>; clearInitiativeOverride: ReturnType<typeof vi.fn>; setInspiration: ReturnType<typeof vi.fn> } } {
    const editState = {
      setSpeedOverride: vi.fn(),
      clearSpeedOverride: vi.fn(),
      setInitiativeOverride: vi.fn(),
      clearInitiativeOverride: vi.fn(),
      setInspiration: vi.fn(),
    };
    return {
      ctx: {
        derived: {
          proficiencyBonus: 2,
          initiative: opts.init ?? 2,
          speed: opts.speed ?? 30,
        },
        resolved: {
          state: { inspiration: 0 },
          definition: { overrides: opts.overrides ?? {} },
        },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("speed tile splits the value into number + unit spans", () => {
    const root = mountContainer();
    const { ctx } = ctxWithOverride({ speed: 30 });
    new StatsTiles().render(root, ctx);
    const tile = root.querySelector(".pc-stats-tile[data-stat='speed']")!;
    expect(tile.querySelector(".pc-stats-tile-num")?.textContent).toBe("30");
    expect(tile.querySelector(".pc-stats-tile-unit")?.textContent).toBe("ft");
    // Existing test still passes: parent .pc-stats-tile-val concatenates to "30ft".
    expect(tile.querySelector(".pc-stats-tile-val")?.textContent).toBe("30ft");
  });

  it("clicking speed number opens an inline number input", () => {
    const root = mountContainer();
    const { ctx } = ctxWithOverride({ speed: 30 });
    new StatsTiles().render(root, ctx);
    root.querySelector<HTMLElement>(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-num")!.click();
    const input = root.querySelector<HTMLInputElement>(".pc-stats-tile[data-stat='speed'] input.pc-edit-inline");
    expect(input).not.toBeNull();
    expect(input!.type).toBe("number");
    expect(input!.value).toBe("30");
    // The "ft" suffix sibling stays in the DOM during editing.
    expect(root.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-unit")?.textContent).toBe("ft");
  });

  it("speed override mark renders when overrides.speed is set, clears via click", () => {
    const root = mountContainer();
    const { ctx, editState } = ctxWithOverride({ speed: 40, overrides: { speed: 40 } });
    new StatsTiles().render(root, ctx);
    const mark = root.querySelector<HTMLElement>(".pc-stats-tile[data-stat='speed'] .archivist-override-mark");
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe("*");
    mark!.click();
    expect(editState.clearSpeedOverride).toHaveBeenCalled();
  });

  it("initiative tile renders click-to-edit on its value span", () => {
    const root = mountContainer();
    const { ctx } = ctxWithOverride({ init: 2 });
    new StatsTiles().render(root, ctx);
    const valEl = root.querySelector<HTMLElement>(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")!;
    expect(valEl.textContent).toBe("+2");
    valEl.click();
    const input = root.querySelector<HTMLInputElement>(".pc-stats-tile[data-stat='init'] input.pc-edit-inline");
    expect(input).not.toBeNull();
    // Raw integer in the input — the +/− sign is only on the read-only display.
    expect(input!.value).toBe("2");
  });

  it("initiative tile accepts negative input — input value is the raw integer", () => {
    const root = mountContainer();
    const { ctx } = ctxWithOverride({ init: -3 });
    new StatsTiles().render(root, ctx);
    const valEl = root.querySelector<HTMLElement>(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")!;
    expect(valEl.textContent).toBe("-3");
    valEl.click();
    const input = root.querySelector<HTMLInputElement>(".pc-stats-tile[data-stat='init'] input.pc-edit-inline");
    expect(input!.value).toBe("-3");
  });

  it("initiative override mark renders when overrides.initiative is set", () => {
    const root = mountContainer();
    const { ctx, editState } = ctxWithOverride({ init: 5, overrides: { initiative: 5 } });
    new StatsTiles().render(root, ctx);
    const mark = root.querySelector<HTMLElement>(".pc-stats-tile[data-stat='init'] .archivist-override-mark");
    expect(mark).not.toBeNull();
    mark!.click();
    expect(editState.clearInitiativeOverride).toHaveBeenCalled();
  });
});
