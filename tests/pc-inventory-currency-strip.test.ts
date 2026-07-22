/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";

const openCoinModalMock = vi.hoisted(() => vi.fn());
const refreshCoinModalMock = vi.hoisted(() => vi.fn());
vi.mock("../packages/obsidian/src/modules/pc/components/coin-modal", () => ({
  openCoinModal: openCoinModalMock,
  refreshCoinModal: refreshCoinModalMock,
  closeCoinModal: vi.fn(),
}));

import { CurrencyStrip } from "../packages/obsidian/src/modules/pc/components/inventory/currency-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function makeCtx(currency: { pp?: number; gp?: number; ep?: number; sp?: number; cp?: number }): ComponentRenderContext {
  return {
    resolved: { definition: { currency } } as never,
    derived: {} as never, services: {} as never, app: {} as never, editState: null,
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

describe("CurrencyStrip — modal mode (sheet)", () => {
  const editState = { setCurrency: vi.fn() } as never;

  it("renders no inline editing and marks the row clickable; click opens the modal", () => {
    openCoinModalMock.mockClear();
    const root = mountContainer();
    const ctx = { ...makeCtx({ gp: 100 }), editState } as ComponentRenderContext;
    new CurrencyStrip({ interaction: "modal" }).render(root, ctx);
    const row = root.querySelector(".pc-currency-row") as HTMLElement;
    expect(row.classList.contains("pc-currency-clickable")).toBe(true);
    expect(root.querySelector("input")).toBeNull();
    expect(root.querySelector(".pc-currency-val.pc-edit-click")).toBeNull();
    row.click();
    expect(openCoinModalMock).toHaveBeenCalledTimes(1);
    expect(root.querySelector("input")).toBeNull(); // still no inline edit
  });

  it("calls refreshCoinModal on every modal-mode render, never in inline mode", () => {
    refreshCoinModalMock.mockClear();
    const root = mountContainer();
    new CurrencyStrip({ interaction: "modal" }).render(root, makeCtx({ gp: 1 }));
    expect(refreshCoinModalMock).toHaveBeenCalledTimes(1);
    new CurrencyStrip().render(mountContainer(), makeCtx({ gp: 1 }));
    expect(refreshCoinModalMock).toHaveBeenCalledTimes(1);
  });

  it("hides the EP cell at 0 in modal mode, keeps it when ep > 0", () => {
    const root = mountContainer();
    new CurrencyStrip({ interaction: "modal" }).render(root, makeCtx({ pp: 1, gp: 2, ep: 0, sp: 3, cp: 4 }));
    const denoms = [...root.querySelectorAll(".pc-currency-denom")].map((d) => d.textContent);
    expect(denoms).toEqual(["PP", "GP", "SP", "CP"]);
    const root2 = mountContainer();
    new CurrencyStrip({ interaction: "modal" }).render(root2, makeCtx({ ep: 4 }));
    expect([...root2.querySelectorAll(".pc-currency-denom")].map((d) => d.textContent))
      .toEqual(["PP", "GP", "EP", "SP", "CP"]);
  });

  it("inline mode still shows EP at 0 (builder has no modal fallback)", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({ ep: 0 }));
    expect([...root.querySelectorAll(".pc-currency-denom")].map((d) => d.textContent))
      .toEqual(["PP", "GP", "EP", "SP", "CP"]);
  });

  it("read-only modal mode (no editState) is not clickable", () => {
    openCoinModalMock.mockClear();
    const root = mountContainer();
    new CurrencyStrip({ interaction: "modal" }).render(root, makeCtx({ gp: 1 }));
    const row = root.querySelector(".pc-currency-row") as HTMLElement;
    expect(row.classList.contains("pc-currency-clickable")).toBe(false);
    row.click();
    expect(openCoinModalMock).not.toHaveBeenCalled();
  });
});
