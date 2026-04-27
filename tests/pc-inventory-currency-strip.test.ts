/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { CurrencyStrip } from "../src/modules/pc/components/inventory/currency-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function makeCtx(currency: { pp?: number; gp?: number; ep?: number; sp?: number; cp?: number }): ComponentRenderContext {
  return {
    resolved: { definition: { currency } } as never,
    derived: {} as never, core: {} as never, app: {} as never, editState: null,
  };
}

describe("CurrencyStrip — redesigned", () => {
  it("renders 5 coin cells in pp/gp/ep/sp/cp order", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({ pp: 2, gp: 147, ep: 0, sp: 35, cp: 12 }));
    const cells = [...root.querySelectorAll(".pc-currency-cell")];
    expect(cells.map((c) => c.querySelector(".pc-currency-denom")?.textContent)).toEqual(["PP", "GP", "EP", "SP", "CP"]);
    expect(cells.map((c) => c.querySelector(".pc-currency-val")?.textContent)).toEqual(["2", "147", "0", "35", "12"]);
  });

  it("denom span carries coin-specific class for color", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({ pp: 1 }));
    expect(root.querySelector(".pc-currency-denom.coin-pp")).toBeTruthy();
    expect(root.querySelector(".pc-currency-denom.coin-gp")).toBeTruthy();
  });

  it("does NOT render a 'Wealth' label", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({}));
    expect(root.textContent?.toLowerCase()).not.toContain("wealth");
  });

  it("clicking a value cell in edit mode commits via setCurrency", () => {
    const setCurrency = vi.fn();
    const root = mountContainer();
    const editCtx = { ...makeCtx({ gp: 100 }), editState: { setCurrency } } as unknown as ComponentRenderContext;
    new CurrencyStrip().render(root, editCtx);
    const gpVal = [...root.querySelectorAll(".pc-currency-val")][1] as HTMLElement;
    gpVal.click();
    const input = root.querySelector("input[type='number']") as HTMLInputElement;
    input.value = "150";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(setCurrency).toHaveBeenCalledWith("gp", 150);
  });
});
