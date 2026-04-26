/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { InventoryRow } from "../src/modules/pc/components/inventory/inventory-row";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { EquipmentEntry, ResolvedEquipped } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const make = (
  item: string,
  opts: { entity?: object | null; entityType?: string | null; entry?: Partial<EquipmentEntry> } = {},
): { entry: EquipmentEntry; resolved: ResolvedEquipped } => {
  const entry = { item, ...opts.entry } as EquipmentEntry;
  const inline = opts.entity === null;
  const entityType = opts.entityType !== undefined
    ? opts.entityType
    : (inline ? null : "item");
  return {
    entry,
    resolved: { index: 0, entity: opts.entity as never, entityType, entry } as ResolvedEquipped,
  };
};

describe("InventoryRow", () => {
  it("renders name + type subtitle for a magical item", () => {
    const it = make("[[ring-of-evasion]]", {
      entity: { name: "Ring of Evasion", type: "ring", rarity: "rare" },
      entityType: "item",
    });
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
    expect(root.querySelector(".pc-inv-row .pc-inv-name")?.textContent).toBe("Ring of Evasion");
    expect(root.querySelector(".pc-inv-row .pc-inv-name")?.classList.contains("rarity-rare")).toBe(true);
    expect(root.querySelector(".pc-inv-row .pc-inv-sub")?.textContent).toMatch(/Ring/i);
    expect(root.querySelector(".pc-inv-row .pc-inv-sub")?.textContent).toMatch(/rare/i);
  });

  it("equipped row carries .equipped class", () => {
    const it = make("[[longsword]]", {
      entity: { name: "Longsword" },
      entityType: "weapon",
      entry: { equipped: true },
    });
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
    expect(root.querySelector(".pc-inv-row")?.classList.contains("equipped")).toBe(true);
    expect(root.querySelector(".pc-inv-sub")?.textContent).toMatch(/Equipped/i);
  });

  it("attuned row carries .attuned class", () => {
    const it = make("[[ring-of-evasion]]", {
      entity: { name: "Ring of Evasion", type: "ring", rarity: "rare", attunement: true },
      entityType: "item",
      entry: { attuned: true },
    });
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
    expect(root.querySelector(".pc-inv-row")?.classList.contains("attuned")).toBe(true);
    expect(root.querySelector(".pc-inv-sub")?.textContent).toMatch(/Attuned/i);
  });

  it("equipped + attuned uses single rail (one class set, no width changes)", () => {
    const it = make("[[ring-of-evasion]]", {
      entity: { name: "Ring of Evasion", type: "ring", rarity: "rare", attunement: true },
      entityType: "item",
      entry: { equipped: true, attuned: true },
    });
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
    const row = root.querySelector(".pc-inv-row");
    expect(row?.classList.contains("equipped")).toBe(true);
    expect(row?.classList.contains("attuned")).toBe(true);
    expect(row?.querySelector(".pc-inv-sub")?.textContent).toMatch(/Equipped.*Attuned/i);
  });

  it("inline (null entity) row uses italic muted name", () => {
    const it = make("50 ft of hempen rope", { entity: null });
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
    const name = root.querySelector(".pc-inv-name");
    expect(name?.textContent).toBe("50 ft of hempen rope");
    expect(name?.classList.contains("is-inline")).toBe(true);
  });

  it("clicking row toggles .expanded class via onToggle", () => {
    const it = make("[[longsword]]", { entity: { name: "Longsword" }, entityType: "weapon" });
    const onToggle = vi.fn();
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null, onToggle });
    (root.querySelector(".pc-inv-row") as HTMLElement).click();
    expect(onToggle).toHaveBeenCalledWith(0); // index = 0
  });

  it("clicking the toggle column calls editState.equipItem and stops propagation (no expand)", () => {
    const it = make("[[longsword]]", { entity: { name: "Longsword" }, entityType: "weapon" });
    const onToggle = vi.fn();
    const equipItem = vi.fn().mockReturnValue({ kind: "ok" });
    const editState = { equipItem, unequipItem: vi.fn() };
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: editState as never, onToggle });
    (root.querySelector(".pc-inv-toggle") as HTMLElement).click();
    expect(equipItem).toHaveBeenCalledWith(0);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
