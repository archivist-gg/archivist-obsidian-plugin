/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
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
});
