/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { HpWidget } from "../src/modules/pc/components/hp-widget";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(hp: { current: number; max: number; temp: number }): ComponentRenderContext {
  return { derived: { hp } } as unknown as ComponentRenderContext;
}

describe("HpWidget", () => {
  it("renders HEAL / input / DAMAGE column + CURRENT/MAX/TEMP nums + HIT POINTS label", () => {
    const root = mountContainer();
    new HpWidget().render(root, ctx({ current: 71, max: 71, temp: 0 }));
    const wrap = root.querySelector(".pc-panel.pc-hp-widget");
    expect(wrap).not.toBeNull();
    expect(wrap?.querySelector("button.pc-hp-heal")?.textContent).toBe("HEAL");
    expect(wrap?.querySelector("input.pc-hp-input")).not.toBeNull();
    expect(wrap?.querySelector("button.pc-hp-damage")?.textContent).toBe("DAMAGE");
    expect(wrap?.querySelector(".pc-hp-current .pc-hp-val")?.textContent).toBe("71");
    expect(wrap?.querySelector(".pc-hp-max .pc-hp-val")?.textContent).toBe("71");
    expect(wrap?.querySelector(".pc-hp-temp .pc-hp-val")?.textContent).toBe("—");
    expect(wrap?.querySelector(".pc-hp-label")?.textContent).toBe("HIT POINTS");
  });

  it("shows numeric TEMP when > 0", () => {
    const root = mountContainer();
    new HpWidget().render(root, ctx({ current: 60, max: 71, temp: 5 }));
    expect(root.querySelector(".pc-hp-temp .pc-hp-val")?.textContent).toBe("5");
  });

  it("inputs and buttons are inert (SP3 render-only)", () => {
    const root = mountContainer();
    new HpWidget().render(root, ctx({ current: 71, max: 71, temp: 0 }));
    const heal = root.querySelector<HTMLButtonElement>("button.pc-hp-heal")!;
    expect(() => heal.click()).not.toThrow();
    const input = root.querySelector<HTMLInputElement>("input.pc-hp-input")!;
    expect(input.type).toBe("number");
    expect(input.value).toBe("");
  });

describe("HpWidget — interactive (SP4)", () => {
  function interactiveCtx(hp: { current: number; max: number; temp: number }, ds?: { successes: number; failures: number }) {
    const state: Record<string, unknown> = {
      hp: { ...hp },
      hit_dice: {},
      spell_slots: {},
      concentration: null,
      conditions: [],
      inspiration: 0,
      exhaustion: 0,
    };
    if (ds) state.death_saves = ds;
    const editState = {
      heal: vi.fn(),
      damage: vi.fn(),
    };
    return {
      ctx: {
        derived: { hp },
        resolved: { state, definition: {} },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("HEAL click calls editState.heal with input value", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 10, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-input")!;
    input.value = "5";
    root.querySelector<HTMLButtonElement>(".pc-hp-heal")!.click();
    expect(editState.heal).toHaveBeenCalledWith(5);
    expect(input.value).toBe("");
  });

  it("DAMAGE click calls editState.damage with input value", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 10, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-input")!;
    input.value = "3";
    root.querySelector<HTMLButtonElement>(".pc-hp-damage")!.click();
    expect(editState.damage).toHaveBeenCalledWith(3);
    expect(input.value).toBe("");
  });

  it("Enter key in input calls editState.heal (same as HEAL click)", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 10, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-input")!;
    input.value = "7";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editState.heal).toHaveBeenCalledWith(7);
  });

  it("no-op when input is empty or 0", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 10, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    root.querySelector<HTMLButtonElement>(".pc-hp-heal")!.click();
    expect(editState.heal).not.toHaveBeenCalled();
  });

  it("applies .unconscious class when HP = 0 and failures < 3", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ current: 0, max: 30, temp: 0 }, { successes: 1, failures: 2 });
    new HpWidget().render(root, ctx);
    const wrap = root.querySelector(".pc-hp-widget")!;
    expect(wrap.classList.contains("unconscious")).toBe(true);
    expect(wrap.classList.contains("dead")).toBe(false);
    expect(root.querySelector(".pc-hp-label")?.textContent).toBe("UNCONSCIOUS");
  });

  it("applies .dead class when failures = 3", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ current: 0, max: 30, temp: 0 }, { successes: 0, failures: 3 });
    new HpWidget().render(root, ctx);
    const wrap = root.querySelector(".pc-hp-widget")!;
    expect(wrap.classList.contains("dead")).toBe(true);
    expect(root.querySelector(".pc-hp-label")?.textContent).toBe("DEAD");
  });

  it("input accepts typed value via input event then HEAL reads it (typing contract)", () => {
    // Pins down the "typing works" contract regardless of any document-level
    // hotkey listener that might intercept keystrokes in the real Obsidian
    // environment (Bug 1 reproducer).
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 10, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-input")!;
    input.value = "7";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>(".pc-hp-heal")!.click();
    expect(editState.heal).toHaveBeenCalledWith(7);
  });

  it("input keydown stops propagation so document-level listeners cannot swallow keystrokes", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ current: 10, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-input")!;
    const docHandler = vi.fn();
    document.addEventListener("keydown", docHandler);
    try {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true, cancelable: true }));
      expect(docHandler).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", docHandler);
    }
  });

  it("HEAL button remains clickable in unconscious/dead modes", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 0, max: 30, temp: 0 }, { successes: 0, failures: 3 });
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-input")!;
    input.value = "4";
    root.querySelector<HTMLButtonElement>(".pc-hp-heal")!.click();
    expect(editState.heal).toHaveBeenCalledWith(4);
  });
});
});
