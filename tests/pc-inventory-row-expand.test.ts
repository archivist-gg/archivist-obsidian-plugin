/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderRowExpand } from "../src/modules/pc/components/inventory/inventory-row-expand";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { App } from "obsidian";
import type { EquipmentEntry, ResolvedEquipped } from "../src/modules/pc/pc.types";

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
  it("dispatches to renderItemBlock for plain items", () => {
    const { entry, resolved } = make(
      "[[ring]]",
      { name: "Ring of X", type: "ring", entries: ["A magical ring."] },
      { entityType: "item" },
    );
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null });
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

  it("renders inline-edit form for null entity (inline custom items)", () => {
    const { entry, resolved } = make("50 ft of hempen rope", null);
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: null });
    expect(root.querySelector(".pc-inv-inline-form")).toBeTruthy();
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
});
