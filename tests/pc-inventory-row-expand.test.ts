/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderRowExpand } from "../src/modules/pc/components/inventory/inventory-row-expand";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { App } from "obsidian";
import type { EquipmentEntry, ResolvedEquipped } from "../src/modules/pc/pc.types";

const confirmMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("../src/modules/inquiry/shared/modals/ConfirmModal", () => ({
  confirm: confirmMock,
  confirmDelete: vi.fn().mockResolvedValue(true),
}));

vi.mock("obsidian", () => ({
  MarkdownRenderer: {
    render: async (_app: unknown, md: string, parent: HTMLElement) => {
      const doc = parent.ownerDocument;
      const p = doc.createElement("p");
      p.textContent = md;
      parent.appendChild(p);
    },
  },
  setIcon: vi.fn(),
  Component: class {},
}));

beforeAll(() => installObsidianDomHelpers());

const make = (
  item: string,
  entity: object | null,
  opts: { entityType?: string | null; entry?: Partial<EquipmentEntry> } = {},
): { entry: EquipmentEntry; resolved: ResolvedEquipped } => {
  const entry = { item, ...opts.entry } as EquipmentEntry;
  const inline = entity === null;
  const entityType = opts.entityType !== undefined
    ? opts.entityType
    : (inline ? null : "item");
  return {
    entry,
    resolved: { index: 5, entity: entity as never, entityType, entry } as ResolvedEquipped,
  };
};

describe("renderRowExpand", () => {
  it("dispatches to renderItemBlock for plain items", async () => {
    const { entry, resolved } = make(
      "[[ring]]",
      { name: "Ring of X", type: "ring", entries: ["A magical ring."] },
      { entityType: "item" },
    );
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null });
    // Async item renderer — flush microtasks so the wrapper is filled.
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector(".archivist-item-block")).toBeTruthy();
    expect(root.querySelector(".archivist-item-name")?.textContent).toBe("Ring of X");
  });

  it("dispatches to renderWeaponBlock for weapons", () => {
    const { entry, resolved } = make(
      "[[longsword]]",
      { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" }, properties: ["versatile"] },
      { entityType: "weapon" },
    );
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null });
    expect(root.querySelector(".archivist-weapon-block-wrapper, .archivist-item-block")).toBeTruthy();
    expect(root.textContent).toContain("Longsword");
  });

  it("dispatches to renderArmorBlock for armor", () => {
    const { entry, resolved } = make(
      "[[plate]]",
      { name: "Plate", category: "heavy", ac: { base: 18, flat: 0, add_dex: false }, strength_requirement: 15 },
      { entityType: "armor" },
    );
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null });
    expect(root.querySelector(".archivist-item-block")).toBeTruthy();
    expect(root.textContent).toContain("Plate");
  });

  it("renders an orphan placeholder for null entity (no compendium entry)", () => {
    const { entry, resolved } = make("50 ft of hempen rope", null);
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null });
    const orphan = root.querySelector(".pc-inv-orphan");
    expect(orphan).toBeTruthy();
    expect(orphan?.textContent).toContain("50 ft of hempen rope");
    expect(orphan?.textContent?.toLowerCase()).toContain("no compendium entry");
  });

  it("renders PC-actions strip with Equip / Remove (no Attune for non-attune items)", () => {
    const { entry, resolved } = make(
      "[[longsword]]",
      { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } },
      { entityType: "weapon" },
    );
    const editState = {
      equipItem: vi.fn().mockReturnValue({ kind: "ok" }),
      unequipItem: vi.fn(), removeItem: vi.fn(),
      attuneItem: vi.fn(), unattuneItem: vi.fn(),
    };
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
    const labels = [...root.querySelectorAll(".pc-inv-action")].map((b) => b.textContent?.trim().toLowerCase());
    expect(labels.some((l) => l?.includes("equip"))).toBe(true);
    expect(labels.some((l) => l?.includes("remove"))).toBe(true);
    expect(labels.some((l) => l?.includes("attune"))).toBe(false);
  });

  it("includes Attune button when item requires attunement", () => {
    const { entry, resolved } = make(
      "[[ring-of-evasion]]",
      { name: "Ring of Evasion", type: "ring", attunement: true },
      { entityType: "item" },
    );
    const editState = {
      equipItem: vi.fn().mockReturnValue({ kind: "ok" }),
      unequipItem: vi.fn(), removeItem: vi.fn(),
      attuneItem: vi.fn().mockReturnValue({ kind: "ok" }), unattuneItem: vi.fn(),
    };
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
    const labels = [...root.querySelectorAll(".pc-inv-action")].map((b) => b.textContent?.trim().toLowerCase());
    expect(labels.some((l) => l?.includes("attune"))).toBe(true);
  });

  it("clicking Equip calls editState.equipItem with the entry index", () => {
    const { entry, resolved } = make(
      "[[longsword]]",
      { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } },
      { entityType: "weapon" },
    );
    const equipItem = vi.fn().mockReturnValue({ kind: "ok" });
    const editState = { equipItem, unequipItem: vi.fn(), removeItem: vi.fn(), attuneItem: vi.fn(), unattuneItem: vi.fn() };
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
    const eqBtn = [...root.querySelectorAll(".pc-inv-action")].find((b) => b.textContent?.toLowerCase().includes("equip")) as HTMLElement;
    eqBtn.click();
    expect(equipItem).toHaveBeenCalledWith(5); // resolved.index
  });

  describe("Unequip + attunement flow", () => {
    it("clicking Unequip on a non-attuned equipped item unequips directly without confirm", async () => {
      confirmMock.mockClear();
      const { entry, resolved } = make(
        "[[longsword]]",
        { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } },
        { entityType: "weapon", entry: { equipped: true, attuned: false } },
      );
      const unequipItem = vi.fn();
      const unattuneItem = vi.fn();
      const editState = {
        equipItem: vi.fn().mockReturnValue({ kind: "ok" }),
        unequipItem, removeItem: vi.fn(),
        attuneItem: vi.fn().mockReturnValue({ kind: "ok" }), unattuneItem,
      };
      const root = mountContainer();
      renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
      const eqBtn = [...root.querySelectorAll(".pc-inv-action")].find((b) => b.textContent?.toLowerCase().includes("unequip")) as HTMLElement;
      eqBtn.click();
      await Promise.resolve();
      expect(confirmMock).not.toHaveBeenCalled();
      expect(unequipItem).toHaveBeenCalledWith(5);
      expect(unattuneItem).not.toHaveBeenCalled();
    });

    it("clicking Unequip on an attuned item shows confirm; on confirm, unattunes then unequips", async () => {
      confirmMock.mockClear();
      confirmMock.mockResolvedValueOnce(true);
      const { entry, resolved } = make(
        "[[ring-of-evasion]]",
        { name: "Ring of Evasion", type: "ring", attunement: true },
        { entityType: "item", entry: { equipped: true, attuned: true } },
      );
      const order: string[] = [];
      const unequipItem = vi.fn(() => { order.push("unequip"); });
      const unattuneItem = vi.fn(() => { order.push("unattune"); });
      const editState = {
        equipItem: vi.fn().mockReturnValue({ kind: "ok" }),
        unequipItem, removeItem: vi.fn(),
        attuneItem: vi.fn().mockReturnValue({ kind: "ok" }), unattuneItem,
      };
      const root = mountContainer();
      renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
      const eqBtn = [...root.querySelectorAll(".pc-inv-action")].find((b) => b.textContent?.toLowerCase().includes("unequip")) as HTMLElement;
      eqBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(unattuneItem).toHaveBeenCalledWith(5);
      expect(unequipItem).toHaveBeenCalledWith(5);
      expect(order).toEqual(["unattune", "unequip"]);
    });

    it("clicking Unequip on an attuned item; on cancel, leaves state unchanged", async () => {
      confirmMock.mockClear();
      confirmMock.mockResolvedValueOnce(false);
      const { entry, resolved } = make(
        "[[ring-of-evasion]]",
        { name: "Ring of Evasion", type: "ring", attunement: true },
        { entityType: "item", entry: { equipped: true, attuned: true } },
      );
      const unequipItem = vi.fn();
      const unattuneItem = vi.fn();
      const editState = {
        equipItem: vi.fn().mockReturnValue({ kind: "ok" }),
        unequipItem, removeItem: vi.fn(),
        attuneItem: vi.fn().mockReturnValue({ kind: "ok" }), unattuneItem,
      };
      const root = mountContainer();
      renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
      const eqBtn = [...root.querySelectorAll(".pc-inv-action")].find((b) => b.textContent?.toLowerCase().includes("unequip")) as HTMLElement;
      eqBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(unattuneItem).not.toHaveBeenCalled();
      expect(unequipItem).not.toHaveBeenCalled();
    });
  });

  it("magic weapon (entityType='item' with base_item) shows weapon block + item card", async () => {
    const longsword = {
      slug: "longsword",
      name: "Longsword",
      category: "martial-melee",
      damage: { dice: "1d8", type: "slashing" },
      properties: ["versatile"],
    };
    const flameTongue = {
      name: "Flame Tongue Longsword",
      type: "weapon",
      rarity: "rare",
      base_item: "[[SRD 5e/Weapons/Longsword|Longsword]]",
      description: "Flames erupt from the blade.",
    };
    const registry = buildMockRegistry([
      { slug: "longsword", entityType: "weapon", data: longsword, name: "Longsword" },
    ]);
    const { entry, resolved } = make(
      "[[flame-tongue-longsword]]",
      flameTongue,
      { entityType: "item", entry: { equipped: true } },
    );
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null, registry });
    // Flush microtasks so the async item renderer fills its wrapper.
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector(".archivist-weapon-block-wrapper, .archivist-weapon-block")).toBeTruthy();
    expect(root.querySelector(".archivist-item-block")).toBeTruthy();
  });
});
