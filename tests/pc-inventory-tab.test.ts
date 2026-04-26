/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryTab } from "../src/modules/pc/components/inventory-tab";
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

function ctxWith(c: Character, derivedOverrides: Partial<DerivedStats> = {}): ComponentRenderContext {
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3, ...derivedOverrides } as DerivedStats,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("InventoryTab (redesigned)", () => {
  it("renders the four loadout slots", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    const slots = root.querySelectorAll(".pc-loadout-slot");
    expect(slots).toHaveLength(4);
  });

  it("renders toolbar with search and Add Item button", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    expect(root.querySelector(".pc-inv-search input")).toBeTruthy();
    expect(root.querySelector(".pc-inv-add")).toBeTruthy();
  });

  it("renders three filter chip groups", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    const labels = [...root.querySelectorAll(".pc-inv-filter-group-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Status", "Type", "Rarity"]);
  });

  it("renders empty-state message when no equipment", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    expect(root.querySelector(".pc-inv-empty")?.textContent).toMatch(/no items/i);
  });

  it("renders alphabetical rows for each equipment entry", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]" }, { item: "[[plate]]" }];
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c));
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(2);
  });

  it("currency strip renders all 5 coins", () => {
    const c = baseChar();
    c.currency = { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 };
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c));
    expect(root.querySelectorAll(".pc-currency-cell")).toHaveLength(5);
  });

  it("renders carried-weight + count in heading", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[a]]" }, { item: "[[b]]" }];
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, { carriedWeight: 12.5 }));
    expect(root.querySelector(".pc-inv-meta-suffix")?.textContent).toMatch(/2 items/);
    expect(root.querySelector(".pc-inv-meta-suffix")?.textContent).toMatch(/12\.5/);
  });

  it("renders attunement strip with N medallions matching attunementLimit", () => {
    const c = baseChar();
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, { attunementLimit: 3 }));
    expect(root.querySelectorAll(".pc-medallion")).toHaveLength(3);
    expect(root.querySelector(".pc-attune-count")?.textContent).toMatch(/0\s*\/\s*3/);
  });
});
