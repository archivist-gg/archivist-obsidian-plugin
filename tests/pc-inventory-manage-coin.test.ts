/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { ManageCoinMode } from "../src/modules/pc/components/inventory/manage-coin-mode";
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

function ctx(c: Character, editState: object | null = null): ComponentRenderContext {
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3 } as DerivedStats,
    core: {} as never,
    app: {} as never,
    editState: editState as never,
  };
}

describe("ManageCoinMode", () => {
  it("renders 5 coin rows with name + value", () => {
    const c = baseChar();
    c.currency = { pp: 1, gp: 142, ep: 0, sp: 30, cp: 15 };
    const root = mountContainer();
    new ManageCoinMode().render(root, ctx(c));
    const rows = root.querySelectorAll(".pc-coin-row");
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toContain("Platinum");
    expect(rows[1].textContent).toContain("Gold");
  });

  it("renders total in gp", () => {
    const c = baseChar();
    c.currency = { pp: 1, gp: 100, ep: 0, sp: 10, cp: 0 };
    // 1pp = 10gp; 10sp = 1gp -> total = 10 + 100 + 1 = 111 gp
    const root = mountContainer();
    new ManageCoinMode().render(root, ctx(c));
    expect(root.querySelector(".pc-coin-total-val")?.textContent).toContain("111");
  });

  it("renders Clear button that calls setCurrency with 0 for all coins", () => {
    const setCurrency = vi.fn();
    const c = baseChar();
    c.currency = { pp: 1, gp: 1, ep: 1, sp: 1, cp: 1 };
    const root = mountContainer();
    new ManageCoinMode().render(root, ctx(c, { setCurrency }));
    (root.querySelector(".pc-coin-clear") as HTMLElement).click();
    expect(setCurrency).toHaveBeenCalledWith("pp", 0);
    expect(setCurrency).toHaveBeenCalledWith("gp", 0);
    expect(setCurrency).toHaveBeenCalledWith("ep", 0);
    expect(setCurrency).toHaveBeenCalledWith("sp", 0);
    expect(setCurrency).toHaveBeenCalledWith("cp", 0);
  });
});
