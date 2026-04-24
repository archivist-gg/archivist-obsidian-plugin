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

describe("HpWidget — unconscious body swap (SP4 polish)", () => {
  function unconsciousCtx(successes = 0, failures = 0) {
    const editState = {
      heal: vi.fn(),
      damage: vi.fn(),
      toggleDeathSaveSuccess: vi.fn(),
      toggleDeathSaveFailure: vi.fn(),
    };
    return {
      ctx: {
        derived: { hp: { current: 0, max: 30, temp: 0 } },
        resolved: { state: { death_saves: { successes, failures } } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("renders death-save dots (3 successes, 3 failures) when HP=0", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(1, 1);
    new HpWidget().render(root, ctx);
    expect(root.querySelectorAll(".pc-hp-widget .pc-death-save-success").length).toBe(3);
    expect(root.querySelectorAll(".pc-hp-widget .pc-death-save-failure").length).toBe(3);
  });

  it("does NOT render CURRENT/MAX/TEMP tiles when HP=0", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx();
    new HpWidget().render(root, ctx);
    expect(root.querySelector(".pc-hp-widget .pc-hp-current")).toBeNull();
    expect(root.querySelector(".pc-hp-widget .pc-hp-max")).toBeNull();
    expect(root.querySelector(".pc-hp-widget .pc-hp-temp")).toBeNull();
  });

  it("filled dots reflect state — successes=2 fills the first 2 success dots", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(2, 0);
    new HpWidget().render(root, ctx);
    const successes = [...root.querySelectorAll<HTMLElement>(".pc-hp-widget .pc-death-save-success")];
    expect(successes[0].classList.contains("filled")).toBe(true);
    expect(successes[1].classList.contains("filled")).toBe(true);
    expect(successes[2].classList.contains("filled")).toBe(false);
  });

  it("death-save dot click dispatches toggleDeathSaveSuccess/Failure", () => {
    const root = mountContainer();
    const { ctx, editState } = unconsciousCtx();
    new HpWidget().render(root, ctx);
    const successes = [...root.querySelectorAll<HTMLElement>(".pc-hp-widget .pc-death-save-success")];
    const failures = [...root.querySelectorAll<HTMLElement>(".pc-hp-widget .pc-death-save-failure")];
    successes[1].click();
    failures[2].click();
    expect(editState.toggleDeathSaveSuccess).toHaveBeenCalledWith(1);
    expect(editState.toggleDeathSaveFailure).toHaveBeenCalledWith(2);
  });

  it("HEAL button is still present and functional in unconscious state", () => {
    const root = mountContainer();
    const { ctx, editState } = unconsciousCtx();
    new HpWidget().render(root, ctx);
    const input = root.querySelector<HTMLInputElement>(".pc-hp-widget .pc-hp-input")!;
    input.value = "5";
    root.querySelector<HTMLButtonElement>(".pc-hp-widget .pc-hp-heal")!.click();
    expect(editState.heal).toHaveBeenCalledWith(5);
  });

  it("dead state (failures=3) renders DEAD label, keeps HEAL clickable", () => {
    const root = mountContainer();
    const { ctx, editState } = unconsciousCtx(0, 3);
    new HpWidget().render(root, ctx);
    expect(root.querySelector(".pc-hp-widget")?.classList.contains("dead")).toBe(true);
    expect(root.querySelector(".pc-hp-widget .pc-hp-label")?.textContent).toBe("DEAD");
    const input = root.querySelector<HTMLInputElement>(".pc-hp-widget .pc-hp-input")!;
    input.value = "4";
    root.querySelector<HTMLButtonElement>(".pc-hp-widget .pc-hp-heal")!.click();
    expect(editState.heal).toHaveBeenCalledWith(4);
  });

  it("normal HP>0 state still shows CURRENT/MAX/TEMP (no regression)", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(0, 0);
    // Override to HP>0 for this test
    (ctx as unknown as { derived: { hp: { current: number; max: number; temp: number } } }).derived.hp = { current: 15, max: 30, temp: 0 };
    new HpWidget().render(root, ctx);
    expect(root.querySelector(".pc-hp-widget .pc-hp-current")).not.toBeNull();
    expect(root.querySelector(".pc-hp-widget .pc-death-save-success")).toBeNull();
  });

  it("renders STABLE class + label when HP=0 and successes=3 (and failures<3)", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(3, 0);
    new HpWidget().render(root, ctx);
    const wrap = root.querySelector(".pc-hp-widget")!;
    expect(wrap.classList.contains("stable")).toBe(true);
    expect(wrap.classList.contains("unconscious")).toBe(false);
    expect(wrap.classList.contains("dead")).toBe(false);
    expect(root.querySelector(".pc-hp-widget .pc-hp-label")?.textContent).toBe("STABLE");
  });

  it("STABLE precedence: dead wins when both successes=3 AND failures=3", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(3, 3);
    new HpWidget().render(root, ctx);
    expect(root.querySelector(".pc-hp-widget")?.classList.contains("dead")).toBe(true);
    expect(root.querySelector(".pc-hp-widget")?.classList.contains("stable")).toBe(false);
    expect(root.querySelector(".pc-hp-widget .pc-hp-label")?.textContent).toBe("DEAD");
  });

  it("STABLE still shows death-save dots (for potential un-click)", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(3, 0);
    new HpWidget().render(root, ctx);
    expect(root.querySelectorAll(".pc-hp-widget .pc-death-save-success").length).toBe(3);
    expect(root.querySelectorAll(".pc-hp-widget .pc-death-save-failure").length).toBe(3);
    const successDots = [...root.querySelectorAll<HTMLElement>(".pc-hp-widget .pc-death-save-success")];
    expect(successDots.every((d) => d.classList.contains("filled"))).toBe(true);
  });

  it("STABLE column structure: two columns (Success/Failure) without a divider", () => {
    const root = mountContainer();
    const { ctx } = unconsciousCtx(3, 0);
    new HpWidget().render(root, ctx);
    const pair = root.querySelector(".pc-hp-ds-pair")!;
    const cols = pair.querySelectorAll(".pc-hp-ds-col");
    expect(cols.length).toBe(2);
    // Columns contain the "Success" and "Failure" labels (in order)
    const heads = [...root.querySelectorAll<HTMLElement>(".pc-hp-ds-col-head")].map(
      (h) => h.textContent?.trim()
    );
    expect(heads).toEqual(["Success", "Failure"]);
  });
});

describe("HpWidget — click-to-edit numerics (SP4b)", () => {
  function interactiveCtx(hp: { current: number; max: number; temp: number }, overridesHpMax?: number) {
    const state: Record<string, unknown> = {
      hp: { ...hp }, hit_dice: {}, spell_slots: {},
      concentration: null, conditions: [], inspiration: 0, exhaustion: 0,
    };
    const editState = {
      heal: vi.fn(), damage: vi.fn(),
      setCurrentHp: vi.fn(), setTempHP: vi.fn(),
      setMaxHpOverride: vi.fn(), clearMaxHpOverride: vi.fn(),
    };
    const overrides = overridesHpMax !== undefined ? { hp: { max: overridesHpMax } } : {};
    return {
      ctx: {
        derived: { hp },
        resolved: { state, definition: { overrides } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("click CURRENT value opens input, Enter commits via setCurrentHp", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 20, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const val = root.querySelector<HTMLElement>(".pc-hp-current .pc-hp-val")!;
    val.click();
    const input = root.querySelector<HTMLInputElement>(".pc-hp-current input.pc-edit-inline")!;
    input.value = "15";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(editState.setCurrentHp).toHaveBeenCalledWith(15);
  });

  it("click MAX value opens input, Enter commits via setMaxHpOverride", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 20, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const val = root.querySelector<HTMLElement>(".pc-hp-max .pc-hp-val")!;
    val.click();
    const input = root.querySelector<HTMLInputElement>(".pc-hp-max input.pc-edit-inline")!;
    input.value = "40";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(editState.setMaxHpOverride).toHaveBeenCalledWith(40);
  });

  it("click TEMP opens input with 0 when display shows dash", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ current: 20, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    const val = root.querySelector<HTMLElement>(".pc-hp-temp .pc-hp-val")!;
    expect(val.textContent).toBe("—");
    val.click();
    const input = root.querySelector<HTMLInputElement>(".pc-hp-temp input.pc-edit-inline")!;
    expect(input.value).toBe("0");
  });

  it("renders override mark on MAX column when overrides.hp.max is set", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ current: 20, max: 40, temp: 0 }, 40);
    new HpWidget().render(root, ctx);
    const mark = root.querySelector(".pc-hp-max .archivist-override-mark");
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe("*");
  });

  it("click on MAX override mark calls clearMaxHpOverride", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ current: 20, max: 40, temp: 0 }, 40);
    new HpWidget().render(root, ctx);
    root.querySelector<HTMLElement>(".pc-hp-max .archivist-override-mark")!.click();
    expect(editState.clearMaxHpOverride).toHaveBeenCalledTimes(1);
  });

  it("unconscious mode does NOT render editable CURRENT/MAX/TEMP inputs", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ current: 0, max: 30, temp: 0 });
    new HpWidget().render(root, ctx);
    // Death-saves panel should replace the nums
    expect(root.querySelector(".pc-hp-current")).toBeNull();
    expect(root.querySelector(".pc-hp-max")).toBeNull();
  });
});
});
