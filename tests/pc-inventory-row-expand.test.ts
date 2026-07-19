/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderRowExpand } from "../packages/obsidian/src/modules/pc/components/inventory/inventory-row-expand";
import { buildScrollSpellCandidates } from "../packages/obsidian/src/modules/pc/components/inventory/scroll-spell-picker";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { App } from "obsidian";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";

const confirmMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("../packages/obsidian/src/shared/modals/ConfirmModal", () => ({
  confirm: confirmMock,
  confirmDelete: vi.fn().mockResolvedValue(true),
}));

const NoticeMock = vi.hoisted(() => vi.fn());
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
  Notice: NoticeMock,
  // The scroll spell picker + identify picker `extends Modal`; the class is only
  // evaluated at import (never opened in these tests), so a bare stub suffices.
  Modal: class {},
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

  it("clicking Equip calls editState.equipItemWithSwap with the entry index", () => {
    const { entry, resolved } = make(
      "[[longsword]]",
      { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } },
      { entityType: "weapon" },
    );
    const equipItemWithSwap = vi.fn().mockReturnValue({});
    const editState = { equipItemWithSwap, unequipItem: vi.fn(), removeItem: vi.fn(), attuneItem: vi.fn(), unattuneItem: vi.fn() };
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
    const eqBtn = [...root.querySelectorAll(".pc-inv-action")].find((b) => b.textContent?.toLowerCase().includes("equip")) as HTMLElement;
    eqBtn.click();
    expect(equipItemWithSwap).toHaveBeenCalledWith(5); // resolved.index
  });

  it("fires a Notice listing all swapped-out occupants when equipItemWithSwap reports names", () => {
    NoticeMock.mockClear();
    const { entry, resolved } = make(
      "[[greatsword]]",
      { name: "Greatsword", category: "martial-melee", damage: { dice: "2d6", type: "slashing" }, properties: ["two_handed"] },
      { entityType: "weapon" },
    );
    const equipItemWithSwap = vi.fn().mockReturnValue({ unequipped: ["Longsword", "Shield"] });
    const editState = { equipItemWithSwap, unequipItem: vi.fn(), removeItem: vi.fn(), attuneItem: vi.fn(), unattuneItem: vi.fn() };
    const root = mountContainer();
    renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never });
    const eqBtn = [...root.querySelectorAll(".pc-inv-action")].find((b) => b.textContent?.toLowerCase().includes("equip")) as HTMLElement;
    eqBtn.click();
    expect(NoticeMock).toHaveBeenCalledTimes(1);
    expect(NoticeMock).toHaveBeenCalledWith("Unequipped Longsword, Shield (slot occupied).");
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

  it("magic weapon (entityType='item' with base_item) renders item card only — no duplicate base weapon block", async () => {
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
      rarity: "rare",
      base_item: "[[SRD 5e/Weapons/Longsword|Longsword]]",
      description: "Flames erupt from the blade.",
    };
    const registry = buildMockRegistry([
      { slug: "srd-5e_longsword", entityType: "weapon", data: longsword, name: "Longsword" },
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
    await Promise.resolve();
    // The item's own card renders — it carries its own `Base: <link>` reference,
    // so the duplicate weapon stat block is redundant and should NOT appear.
    expect(root.querySelector(".archivist-item-block")).toBeTruthy();
    expect(root.querySelector(".archivist-weapon-block-wrapper")).toBeNull();
    expect(root.querySelector(".archivist-weapon-block")).toBeNull();
  });

  describe("scroll + unidentified expand", () => {
    interface SheetOver {
      edition?: "2014" | "2024";
      spells?: unknown[];
      spellcastingClasses?: unknown[];
      abilitySpellcasting?: Record<string, { saveDC: number; attackBonus: number }>;
      spellcasting?: unknown;
      editState?: Record<string, unknown> | null;
      entities?: unknown;
    }
    const sheetCtx = (over: SheetOver): ComponentRenderContext =>
      ({
        resolved: {
          definition: { edition: over.edition ?? "2024", equipment: [] },
          spells: over.spells ?? [],
        },
        derived: {
          spellcastingClasses: over.spellcastingClasses ?? [],
          abilitySpellcasting: over.abilitySpellcasting ?? {},
          spellcasting: over.spellcasting ?? null,
        },
        services: {
          entities: over.entities ?? { getByTypeAndSlug: () => undefined, getBySlug: () => undefined },
        },
        app: {} as App,
        editState: (over.editState ?? null),
      }) as unknown as ComponentRenderContext;

    const invEditState = () => ({
      setEquipmentOverride: vi.fn(),
      identifyItem: vi.fn(),
      equipItem: vi.fn().mockReturnValue({ kind: "ok" }),
      equipItemWithSwap: vi.fn().mockReturnValue({}),
      unequipItem: vi.fn(),
      removeItem: vi.fn(),
      attuneItem: vi.fn().mockReturnValue({ kind: "ok" }),
      unattuneItem: vi.fn(),
    });

    it("buildScrollSpellCandidates keeps only same-level, edition-matched spells", () => {
      const reg = buildMockRegistry([
        { slug: "fireball", entityType: "spell", name: "Fireball", data: { name: "Fireball", level: 3, edition: "2024" } },
        { slug: "lightning-bolt", entityType: "spell", name: "Lightning Bolt", data: { name: "Lightning Bolt", level: 3, edition: "2024" } },
        { slug: "magic-missile", entityType: "spell", name: "Magic Missile", data: { name: "Magic Missile", level: 1, edition: "2024" } },
        { slug: "old-fireball", entityType: "spell", name: "Old Fireball", data: { name: "Old Fireball", level: 3, edition: "2014" } },
      ]);
      const slugs = buildScrollSpellCandidates(reg, 3, "2024").map((c) => c.slug).sort();
      expect(slugs).toEqual(["fireball", "lightning-bolt"]);
      expect(slugs).not.toContain("magic-missile"); // wrong level
      expect(slugs).not.toContain("old-fireball"); // wrong edition
    });

    it("renders the chosen spell as an item-block property with a change CTA + save DC (4C)", async () => {
      const entry: EquipmentEntry = { item: "[[spell-scroll-3rd-level]]", overrides: { spell: "srd-2024_fireball" } };
      const resolved = {
        index: 5,
        entity: { name: "Spell Scroll (3rd Level)", type: "scroll", scroll_level: 3, description: "A scroll." },
        entityType: "item",
        entry,
      } as ResolvedEquipped;
      const editState = invEditState();
      const sheet = sheetCtx({
        spells: [{ source: "item", entryIndex: 5, entity: { name: "Fireball", level: 3 }, ability: "int" }],
        spellcastingClasses: [{ ability: "int" }],
        abilitySpellcasting: { int: { saveDC: 14, attackBonus: 6 } },
        spellcasting: { ability: "int", saveDC: 14, attackBonus: 6 },
        editState,
      });
      const root = mountContainer();
      renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never, sheet });
      await Promise.resolve();
      await Promise.resolve();
      const block = root.querySelector(".pc-scroll-spellblock");
      expect(block).toBeTruthy();
      expect(block?.textContent).toContain("Fireball");
      const labels = [...root.querySelectorAll(".pc-scroll-spellblock .archivist-item-property-label")].map((l) => l.textContent);
      expect(labels).toContain("Spell");
      const change = [...root.querySelectorAll(".pc-scroll-spellblock .pc-inline-cta")]
        .find((b) => b.textContent?.toLowerCase().includes("change"));
      expect(change).toBeTruthy();
      expect(block?.textContent).toContain("14"); // save DC from derived.abilitySpellcasting
    });

    it("offers the INT/WIS/CHA capture control for a non-caster scroll with no chosen ability", async () => {
      const entry: EquipmentEntry = { item: "[[spell-scroll-1st-level]]", overrides: { spell: "srd-2024_cure-wounds" } };
      const resolved = {
        index: 5,
        entity: { name: "Spell Scroll (1st Level)", type: "scroll", scroll_level: 1 },
        entityType: "item",
        entry,
      } as ResolvedEquipped;
      const editState = invEditState();
      const sheet = sheetCtx({
        spells: [{ source: "item", entryIndex: 5, entity: { name: "Cure Wounds", level: 1 }, ability: undefined }],
        spellcastingClasses: [], // non-caster
        editState,
      });
      const root = mountContainer();
      renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never, sheet });
      await Promise.resolve();
      expect(root.querySelector(".pc-scroll-ability")).toBeTruthy();
      const btns = [...root.querySelectorAll(".pc-scroll-ability-btn")].map((b) => b.textContent);
      expect(btns).toEqual(["INT", "WIS", "CHA"]);
      (root.querySelector(".pc-scroll-ability-btn") as HTMLElement).click();
      expect(editState.setEquipmentOverride).toHaveBeenCalledWith(5, { spell_ability: "int" });
    });

    it("renders an Identify button for an unidentified placeholder (5A) and keeps the overrides details", () => {
      const entry: EquipmentEntry = { item: "[[unidentified-potion]]" };
      const resolved = {
        index: 5,
        entity: { name: "Unidentified Potion", type: "potion", unidentified: true, masked_category: "potion", description: "?" },
        entityType: "item",
        entry,
      } as ResolvedEquipped;
      const editState = invEditState();
      const sheet = sheetCtx({ editState, entities: { search: () => [], getBySlug: () => null } });
      const root = mountContainer();
      renderRowExpand(root, { entry, resolved, app: {} as App, editState: editState as never, sheet });
      expect(root.querySelector(".pc-inv-action.pc-identify")).toBeTruthy();
      // The "Action overrides" <details> still renders unchanged.
      const details = root.querySelector("details.pc-override-actions-details");
      expect(details).toBeTruthy();
      expect(details?.querySelector("summary")?.textContent).toBe("Action overrides");
    });
  });
});
