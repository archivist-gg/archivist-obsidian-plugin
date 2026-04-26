/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { CurrencyStrip } from "../src/modules/pc/components/inventory/currency-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { Character, ResolvedCharacter, DerivedStats, EquippedSlots } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const baseChar = (): Character => ({
  name: "T", edition: "2014", race: null, subrace: null, background: null,
  class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [],
  overrides: {},
  state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
});

function ctxWith(c: Character, editState: object | null = null): ComponentRenderContext {
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3 } as DerivedStats,
    core: {} as never,
    app: {} as never,
    editState: editState as never,
  };
}

describe("CurrencyStrip", () => {
  it("renders 5 cells in PP/GP/EP/SP/CP order", () => {
    const c = baseChar();
    c.currency = { pp: 1, gp: 2, ep: 3, sp: 4, cp: 5 };
    const root = mountContainer();
    new CurrencyStrip().render(root, ctxWith(c));
    const cells = [...root.querySelectorAll(".pc-currency-cell")];
    expect(cells).toHaveLength(5);
    expect(cells.map((cell) => cell.querySelector(".pc-currency-label")?.textContent?.trim())).toEqual(["PP", "GP", "EP", "SP", "CP"]);
    expect(cells.map((cell) => cell.querySelector(".pc-currency-val")?.textContent)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("clicking a value cell calls editState.setCurrency on commit", () => {
    const c = baseChar();
    c.currency = { pp: 0, gp: 100, ep: 0, sp: 0, cp: 0 };
    const setCurrency = vi.fn();
    const root = mountContainer();
    new CurrencyStrip().render(root, ctxWith(c, { setCurrency }));
    const gpVal = [...root.querySelectorAll(".pc-currency-val")][1] as HTMLElement;
    gpVal.click();
    const input = root.querySelector("input[type='number']") as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "150";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(setCurrency).toHaveBeenCalledWith("gp", 150);
  });

  it("renders zeros when currency is missing", () => {
    const c = baseChar();
    delete c.currency;
    const root = mountContainer();
    new CurrencyStrip().render(root, ctxWith(c, { setCurrency: vi.fn() }));
    const vals = [...root.querySelectorAll(".pc-currency-val")];
    expect(vals).toHaveLength(5);
    expect(vals.every((v) => v.textContent === "0")).toBe(true);
  });
});
