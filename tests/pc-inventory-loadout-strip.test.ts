/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { LoadoutStrip } from "../src/modules/pc/components/inventory/loadout-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, EquippedSlots, EquipmentEntry, ResolvedCharacter, Character } from "../src/modules/pc/pc.types";

const confirmMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("../src/modules/inquiry/shared/modals/ConfirmModal", () => ({
  confirm: confirmMock,
  confirmDelete: vi.fn().mockResolvedValue(true),
}));

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

function ctxWith(slots: Partial<EquippedSlots> = {}, editState: object | null = null): ComponentRenderContext {
  const c = baseChar();
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: slots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3 } as DerivedStats,
    core: {} as never,
    app: {} as never,
    editState: editState as never,
  };
}

describe("LoadoutStrip", () => {
  it("renders four slots in fixed order", () => {
    const root = mountContainer();
    new LoadoutStrip().render(root, ctxWith());
    const slots = [...root.querySelectorAll("[data-slot]")];
    expect(slots.map((s) => s.getAttribute("data-slot"))).toEqual(["mainhand", "offhand", "armor", "shield"]);
  });

  it("empty slots show italic 'empty' label", () => {
    const root = mountContainer();
    new LoadoutStrip().render(root, ctxWith());
    const empties = root.querySelectorAll(".pc-loadout-val.is-empty");
    expect(empties.length).toBe(4);
    expect(empties[0].textContent?.trim()).toMatch(/empty/i);
  });

  it("filled slot shows item name and stat line", () => {
    const slots: Partial<EquippedSlots> = {
      armor: {
        index: 0,
        entry: { item: "[[plate]]" } as EquipmentEntry,
        entity: { name: "Plate", ac: { base: 18 } } as never,
        entityType: "armor",
      },
    };
    const root = mountContainer();
    new LoadoutStrip().render(root, ctxWith(slots));
    const armorSlot = root.querySelector("[data-slot='armor']");
    expect(armorSlot?.querySelector(".pc-loadout-val")?.textContent).toContain("Plate");
    expect(armorSlot?.querySelector(".pc-loadout-stat")?.textContent).toMatch(/AC 18/);
  });

  it("clicking unequip on a filled slot calls editState.unequipItem with index", async () => {
    confirmMock.mockClear();
    const slots: Partial<EquippedSlots> = {
      mainhand: {
        index: 3,
        entry: { item: "[[longsword]]" } as EquipmentEntry,
        entity: { name: "Longsword" } as never,
        entityType: "weapon",
      },
    };
    const editState = { unequipItem: vi.fn(), unattuneItem: vi.fn() };
    const root = mountContainer();
    new LoadoutStrip().render(root, ctxWith(slots, editState));
    const btn = root.querySelector("[data-slot='mainhand'] .pc-loadout-unequip") as HTMLElement;
    expect(btn).toBeTruthy();
    btn.click();
    await Promise.resolve();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(editState.unequipItem).toHaveBeenCalledWith(3);
    expect(editState.unattuneItem).not.toHaveBeenCalled();
  });

  describe("Unequip + attunement flow", () => {
    it("clicking Unequip on attuned slot shows confirm; on confirm, unattunes then unequips", async () => {
      confirmMock.mockClear();
      confirmMock.mockResolvedValueOnce(true);
      const slots: Partial<EquippedSlots> = {
        mainhand: {
          index: 7,
          entry: { item: "[[ring-of-evasion]]", equipped: true, attuned: true } as EquipmentEntry,
          entity: { name: "Ring of Evasion" } as never,
          entityType: "item",
        },
      };
      const order: string[] = [];
      const unequipItem = vi.fn(() => { order.push("unequip"); });
      const unattuneItem = vi.fn(() => { order.push("unattune"); });
      const editState = { unequipItem, unattuneItem };
      const root = mountContainer();
      new LoadoutStrip().render(root, ctxWith(slots, editState));
      const btn = root.querySelector("[data-slot='mainhand'] .pc-loadout-unequip") as HTMLElement;
      btn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(unattuneItem).toHaveBeenCalledWith(7);
      expect(unequipItem).toHaveBeenCalledWith(7);
      expect(order).toEqual(["unattune", "unequip"]);
    });

    it("clicking Unequip on attuned slot; on cancel, leaves state unchanged", async () => {
      confirmMock.mockClear();
      confirmMock.mockResolvedValueOnce(false);
      const slots: Partial<EquippedSlots> = {
        mainhand: {
          index: 7,
          entry: { item: "[[ring-of-evasion]]", equipped: true, attuned: true } as EquipmentEntry,
          entity: { name: "Ring of Evasion" } as never,
          entityType: "item",
        },
      };
      const unequipItem = vi.fn();
      const unattuneItem = vi.fn();
      const editState = { unequipItem, unattuneItem };
      const root = mountContainer();
      new LoadoutStrip().render(root, ctxWith(slots, editState));
      const btn = root.querySelector("[data-slot='mainhand'] .pc-loadout-unequip") as HTMLElement;
      btn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(unattuneItem).not.toHaveBeenCalled();
      expect(unequipItem).not.toHaveBeenCalled();
    });
  });

  it("renders slot type icon as a typographic glyph", () => {
    const root = mountContainer();
    new LoadoutStrip().render(root, ctxWith());
    expect(root.querySelectorAll(".pc-loadout-icon")).toHaveLength(4);
  });
});
