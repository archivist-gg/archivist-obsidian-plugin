/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { InventoryRow } from "../packages/obsidian/src/modules/pc/components/inventory/inventory-row";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";

const confirmMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("../packages/obsidian/src/shared/modals/ConfirmModal", () => ({
  confirm: confirmMock,
  confirmDelete: vi.fn().mockResolvedValue(true),
}));

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

  it("expanded row carries .pc-row-open (collapsed row does not)", () => {
    const it = make("[[longsword]]", { entity: { name: "Longsword" }, entityType: "weapon" });
    const collapsed = mountContainer();
    new InventoryRow().render(collapsed, { ...it, app: {} as never, editState: null, expanded: false });
    expect(collapsed.querySelector(".pc-inv-row")?.classList.contains("pc-row-open")).toBe(false);
    const open = mountContainer();
    new InventoryRow().render(open, { ...it, app: {} as never, editState: null, expanded: true });
    const row = open.querySelector(".pc-inv-row");
    expect(row?.classList.contains("expanded")).toBe(true);
    expect(row?.classList.contains("pc-row-open")).toBe(true);
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

  it("clicking the toggle column calls editState.equipItemWithSwap and stops propagation (no expand)", () => {
    const it = make("[[longsword]]", { entity: { name: "Longsword" }, entityType: "weapon" });
    const onToggle = vi.fn();
    const equipItemWithSwap = vi.fn().mockReturnValue({});
    const editState = { equipItemWithSwap, unequipItem: vi.fn() };
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: editState as never, onToggle });
    (root.querySelector(".pc-inv-toggle") as HTMLElement).click();
    expect(equipItemWithSwap).toHaveBeenCalledWith(0);
    expect(onToggle).not.toHaveBeenCalled();
  });

  describe("unequip + attunement flow", () => {
    it("clicking toggle on a non-attuned equipped item unequips directly without confirm", async () => {
      confirmMock.mockClear();
      const it = make("[[longsword]]", {
        entity: { name: "Longsword" },
        entityType: "weapon",
        entry: { equipped: true, attuned: false },
      });
      const equipItem = vi.fn().mockReturnValue({ kind: "ok" });
      const unequipItem = vi.fn();
      const unattuneItem = vi.fn();
      const editState = { equipItem, unequipItem, unattuneItem };
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: editState as never });
      (root.querySelector(".pc-inv-toggle") as HTMLElement).click();
      // Allow any pending microtasks to settle
      await Promise.resolve();
      expect(confirmMock).not.toHaveBeenCalled();
      expect(unequipItem).toHaveBeenCalledWith(0);
      expect(unattuneItem).not.toHaveBeenCalled();
    });

    it("clicking toggle on an attuned item shows confirm modal; on confirm, unattunes then unequips", async () => {
      confirmMock.mockClear();
      confirmMock.mockResolvedValueOnce(true);
      const it = make("[[ring-of-evasion]]", {
        entity: { name: "Ring of Evasion", type: "ring", attunement: true },
        entityType: "item",
        entry: { equipped: true, attuned: true },
      });
      const order: string[] = [];
      const equipItem = vi.fn().mockReturnValue({ kind: "ok" });
      const unequipItem = vi.fn(() => { order.push("unequip"); });
      const unattuneItem = vi.fn(() => { order.push("unattune"); });
      const editState = { equipItem, unequipItem, unattuneItem };
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: editState as never });
      (root.querySelector(".pc-inv-toggle") as HTMLElement).click();
      // Wait for confirm promise + subsequent calls
      await Promise.resolve();
      await Promise.resolve();
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(unattuneItem).toHaveBeenCalledWith(0);
      expect(unequipItem).toHaveBeenCalledWith(0);
      expect(order).toEqual(["unattune", "unequip"]);
    });

    it("clicking toggle on an attuned item; on cancel, leaves state unchanged", async () => {
      confirmMock.mockClear();
      confirmMock.mockResolvedValueOnce(false);
      const it = make("[[ring-of-evasion]]", {
        entity: { name: "Ring of Evasion", type: "ring", attunement: true },
        entityType: "item",
        entry: { equipped: true, attuned: true },
      });
      const equipItem = vi.fn().mockReturnValue({ kind: "ok" });
      const unequipItem = vi.fn();
      const unattuneItem = vi.fn();
      const editState = { equipItem, unequipItem, unattuneItem };
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: editState as never });
      (root.querySelector(".pc-inv-toggle") as HTMLElement).click();
      await Promise.resolve();
      await Promise.resolve();
      expect(confirmMock).toHaveBeenCalledTimes(1);
      expect(unattuneItem).not.toHaveBeenCalled();
      expect(unequipItem).not.toHaveBeenCalled();
    });
  });

  describe("scroll + unidentified treatments", () => {
    it("scroll with a chosen spell names the row 'Scroll of <spell> (<level>)' and drops the sub-line chip (P7 F2)", () => {
      const it = make("[[spell-scroll-3rd-level]]", {
        entity: { name: "Spell Scroll (3rd Level)", type: "scroll", rarity: "uncommon", scroll_level: 3 },
        entityType: "item",
        entry: { overrides: { spell: "srd-2024_fireball" } },
      });
      const registry = buildMockRegistry([
        { slug: "srd-2024_fireball", entityType: "spell", data: { name: "Fireball", level: 3 }, name: "Fireball" },
      ]);
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: null, registry });
      // the spell now carries into the row NAME, not a chip
      expect(root.querySelector(".pc-inv-name")?.textContent).toBe("Scroll of Fireball (3rd Level)");
      // the old sub-line chip is gone; the sub-line stays the plain type + rarity
      expect(root.querySelector(".pc-spell-chip")).toBeNull();
      const sub = root.querySelector(".pc-inv-sub")?.textContent ?? "";
      expect(sub).not.toContain("Fireball");
      // an identified scroll has no unset dot / set-spell CTA either
      expect(root.querySelector(".pc-unset-dot")).toBeNull();
      expect(root.querySelector(".pc-inv-sub .pc-inline-cta")).toBeNull();
    });

    it("cantrip scroll names the row 'Scroll of <spell> (Cantrip)'", () => {
      const it = make("[[spell-scroll-cantrip]]", {
        entity: { name: "Spell Scroll (Cantrip)", type: "scroll", rarity: "common", scroll_level: 0 },
        entityType: "item",
        entry: { overrides: { spell: "srd-2024_fire-bolt" } },
      });
      const registry = buildMockRegistry([
        { slug: "srd-2024_fire-bolt", entityType: "spell", data: { name: "Fire Bolt", level: 0 }, name: "Fire Bolt" },
      ]);
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: null, registry });
      expect(root.querySelector(".pc-inv-name")?.textContent).toBe("Scroll of Fire Bolt (Cantrip)");
    });

    it("an explicit name override still wins over the scroll-spell name", () => {
      const it = make("[[spell-scroll-3rd-level]]", {
        entity: { name: "Spell Scroll (3rd Level)", type: "scroll", rarity: "uncommon", scroll_level: 3 },
        entityType: "item",
        entry: { overrides: { name: "Charred Vellum", spell: "srd-2024_fireball" } },
      });
      const registry = buildMockRegistry([
        { slug: "srd-2024_fireball", entityType: "spell", data: { name: "Fireball", level: 3 }, name: "Fireball" },
      ]);
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: null, registry });
      expect(root.querySelector(".pc-inv-name")?.textContent).toBe("Charred Vellum");
    });

    it("scroll with no chosen spell shows the unset dot + set-spell CTA (2B)", () => {
      const it = make("[[spell-scroll-3rd-level]]", {
        entity: { name: "Spell Scroll (3rd Level)", type: "scroll", rarity: "uncommon", scroll_level: 3 },
        entityType: "item",
      });
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
      expect(root.querySelector(".pc-inv-sub .pc-unset-dot")).toBeTruthy();
      const cta = root.querySelector(".pc-inv-sub .pc-inline-cta");
      expect(cta).toBeTruthy();
      expect(cta?.textContent?.toLowerCase()).toContain("set spell");
      expect(root.querySelector(".pc-spell-chip")).toBeNull();
    });

    it("unidentified placeholder: muted-name row, masked-category sub, NO ? glyph (3A)", () => {
      const it = make("[[unidentified-potion]]", {
        entity: { name: "Unidentified Potion", type: "potion", unidentified: true, masked_category: "potion" },
        entityType: "item",
      });
      const root = mountContainer();
      new InventoryRow().render(root, { ...it, app: {} as never, editState: null });
      const row = root.querySelector(".pc-inv-row");
      expect(row?.classList.contains("pc-unidentified")).toBe(true);
      // 3A is WITHOUT the "?" glyph
      expect(root.querySelector(".pc-unid-glyph")).toBeNull();
      expect(root.querySelector(".pc-inv-sub")?.textContent?.toLowerCase()).toContain("potion");
      // the stat / weight / qty cells are hidden until the item is identified
      expect(root.querySelector(".pc-inv-stat")?.textContent).toBe("");
      expect(root.querySelector(".pc-inv-weight")?.textContent).toBe("");
    });
  });

  it("renders magic weapon damage by joining base_item to weapon entity", () => {
    const longsword = {
      slug: "srd-5e_longsword",
      name: "Longsword",
      category: "martial-melee",
      damage: { dice: "1d8", type: "slashing" },
      properties: ["versatile"],
    };
    const flameTongue = {
      name: "Flame Tongue Longsword",
      type: "weapon",
      base_item: "[[SRD 5e/Weapons/Longsword|Longsword]]",
    };
    const it = make("[[flame-tongue-longsword]]", { entity: flameTongue, entityType: "item" });
    const registry = buildMockRegistry([
      { slug: "srd-5e_longsword", entityType: "weapon", data: longsword, name: "Longsword" },
    ]);
    const root = mountContainer();
    new InventoryRow().render(root, { ...it, app: {} as never, editState: null, registry });
    const stat = root.querySelector(".pc-inv-row .pc-inv-stat");
    expect(stat?.textContent ?? "").toContain("1d8");
  });
});
