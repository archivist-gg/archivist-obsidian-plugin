/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { InventoryTab } from "../src/modules/pc/components/inventory-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, EquippedSlots, ResolvedCharacter, Character } from "../src/modules/pc/pc.types";

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

const slotFor = (name: string, category = "armor"): never =>
  ({ index: 0, entity: { name, category, ac: { base: 18, flat: 0, add_dex: false } } as never, entry: {} as never } as never);

function ctxWith(c: Character, derivedOverrides: Partial<DerivedStats> = {}, editState: object | null = null): ComponentRenderContext {
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: {
      ac: 0, acBreakdown: [], attacks: [],
      equippedSlots: {} as EquippedSlots,
      carriedWeight: 0, attunementUsed: 0, attunementLimit: 3,
      ...derivedOverrides,
    } as DerivedStats,
    core: {} as never,
    editState: editState as never,
  };
}

describe("InventoryTab", () => {
  it("renders four slot widgets", () => {
    const c = baseChar();
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c));
    const slots = root.querySelectorAll(".pc-inventory-slot");
    expect(slots).toHaveLength(4);
    expect([...slots].map((s) => s.getAttribute("data-slot"))).toEqual(["mainhand", "offhand", "armor", "shield"]);
  });

  it("renders attunement count line", () => {
    const c = baseChar();
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, { attunementUsed: 2, attunementLimit: 3 }));
    expect(root.querySelector(".pc-inventory-attunement")?.textContent).toMatch(/2\s*\/\s*3/);
  });

  it("carried section lists every entry with equip/remove buttons (when editState present)", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]" }, { item: "[[plate]]" }];
    const editState = { equipItem: vi.fn(), removeItem: vi.fn(), unequipItem: vi.fn(), attuneItem: vi.fn(), unattuneItem: vi.fn(), addItem: vi.fn(), setCurrency: vi.fn(), setCharges: vi.fn() };
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, {}, editState));
    expect(root.querySelectorAll(".pc-inventory-carried-row")).toHaveLength(2);
    expect(root.querySelectorAll(".pc-inventory-equip-btn").length).toBeGreaterThan(0);
  });

  it("currency strip renders all 5 coins", () => {
    const c = baseChar();
    c.currency = { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 };
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c));
    expect(root.querySelectorAll(".pc-currency-cell")).toHaveLength(5);
  });

  it("clicking equip-btn calls editState.equipItem with the index", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]" }];
    const equipItem = vi.fn().mockReturnValue({ kind: "ok" });
    const editState = { equipItem, unequipItem: vi.fn(), removeItem: vi.fn(), attuneItem: vi.fn(), unattuneItem: vi.fn(), addItem: vi.fn(), setCurrency: vi.fn(), setCharges: vi.fn() };
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, {}, editState));
    (root.querySelector(".pc-inventory-equip-btn") as HTMLElement).click();
    expect(equipItem).toHaveBeenCalledWith(0);
  });
});
