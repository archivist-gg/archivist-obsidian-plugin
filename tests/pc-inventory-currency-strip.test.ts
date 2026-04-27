/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
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
});
