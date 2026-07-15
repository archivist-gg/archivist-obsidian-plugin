/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ItemsTable, renderItemRow } from "../packages/obsidian/src/modules/pc/components/actions/items-table";
import type { ItemEntry } from "../packages/obsidian/src/modules/pc/components/actions/action-model";
import type { ItemAction } from "@archivist-gg/dnd5e/item/item.actions-map";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// Collection-path ctx (drives the surviving ItemsTable wrapper, which still
// collects equipped action-bearing items and dispatches to renderItemRow).
// ─────────────────────────────────────────────────────────────
function ctx(opts: { entries: object[]; entityForSlug: (slug: string) => object | null; editState?: CharacterEditState | null }): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: opts.entries } } as never,
    derived: { attacks: [] } as never,
    services: { entities: { getBySlug: (slug: string) => {
      const data = opts.entityForSlug(slug);
      return data ? { entityType: "item", data } : null;
    } } } as never,
    app: {} as never,
    editState: opts.editState ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Row-only drivers — construct a Task-3 ItemEntry and render it directly,
// mirroring how the tab (Task 5) dispatches each collected entry.
// ─────────────────────────────────────────────────────────────
const WAND_ACTION: ItemAction = { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } };

function itemEntry(over: Partial<ItemEntry> = {}): ItemEntry {
  return {
    index: 0,
    entry: { item: "[[wand-of-fireballs]]", equipped: true, attuned: true } as ItemEntry["entry"],
    entity: { name: "Wand of Fireballs", rarity: "very rare", actions: {} },
    entityType: "item",
    action: WAND_ACTION,
    ...over,
  };
}

function rowCtx(editState: CharacterEditState | null = null): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks: [], conditionEffects: undefined } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState,
  };
}

function renderItems(root: HTMLElement, items: ItemEntry[], c: ComponentRenderContext): HTMLElement {
  const list = root.createDiv({ cls: "pc-actions-table pc-items-table" });
  for (const it of items) renderItemRow(list, it, c);
  return list;
}

describe("ItemsTable — collection wrapper", () => {
  it("renders only items with a resolved ItemAction (curated or override)", () => {
    const root = mountContainer();
    new ItemsTable().render(root, ctx({
      entries: [
        { item: "[[wand-of-fireballs]]", equipped: true, attuned: true },
        { item: "[[mundane-rope]]", equipped: true },
      ],
      entityForSlug: (slug) => slug === "wand-of-fireballs"
        ? { name: "Wand of Fireballs", rarity: "very rare", actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } } }
        : { name: "Hempen Rope" },
    }));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Wand of Fireballs");
  });

  it("renders an action row for a PC equipping a compendium-prefixed wand wikilink", () => {
    // Regression for CB-4: PC sheets ship `[[srd-5e_wand-of-fireballs]]` but the
    // curated map keys by bare name; without prefix-stripping the row was missing.
    const root = mountContainer();
    new ItemsTable().render(root, ctx({
      entries: [
        { item: "[[srd-5e_wand-of-fireballs]]", equipped: true, attuned: true },
        { item: "[[srd-5e_necklace-of-fireballs]]", equipped: true },
      ],
      entityForSlug: (slug) => {
        if (slug === "srd-5e_wand-of-fireballs") return { name: "Wand of Fireballs", rarity: "very rare" };
        if (slug === "srd-5e_necklace-of-fireballs") return { name: "Necklace of Fireballs", rarity: "rare" };
        return null;
      },
    }));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Wand of Fireballs");
    expect(rows[1].textContent).toContain("Necklace of Fireballs");
    // Wand has 7 charges from the curated map even though entry has no state.charges.
    const boxes = rows[0].querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(7);
  });
});

describe("renderItemRow", () => {
  it("renders a .pc-action-row (div) carrying the item name + rarity sub", () => {
    const root = mountContainer();
    renderItems(root, [itemEntry()], rowCtx());
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].tagName).toBe("DIV");
    expect(rows[0].textContent).toContain("Wand of Fireballs");
    expect(rows[0].querySelector(".pc-action-row-name.rarity-very-rare")).toBeTruthy();
  });

  it("renders charge boxes when item has charges", () => {
    const root = mountContainer();
    renderItems(root, [itemEntry({
      entry: { item: "[[wand-of-fireballs]]", equipped: true, attuned: true, state: { charges: { current: 5, max: 7 } } } as ItemEntry["entry"],
    })], rowCtx());
    const boxes = root.querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(7);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(2);
  });

  it("clicking pip dispatches editState.setItemCharges keyed on the ORIGINAL index (filter-stable)", () => {
    const root = mountContainer();
    const setItemCharges = vi.fn();
    // index 2 (not the render-loop position) proves the write-back uses item.index.
    renderItems(root, [itemEntry({
      index: 2,
      entry: { item: "[[wand-of-fireballs]]", equipped: true, state: { charges: { current: 7, max: 7 } } } as ItemEntry["entry"],
    })], rowCtx({ setItemCharges } as unknown as CharacterEditState));
    const firstEmpty = root.querySelector<HTMLElement>(".archivist-toggle-box:not(.archivist-toggle-box-checked)")!;
    firstEmpty.click();
    expect(setItemCharges).toHaveBeenCalledWith(2, 1, 7);
  });

  it("clicking checked box decrements via setItemCharges", () => {
    const root = mountContainer();
    const setItemCharges = vi.fn();
    renderItems(root, [itemEntry({
      index: 0,
      action: { cost: "action", range: "150 ft.", max_charges: 7 },
      entry: { item: "[[wand-of-fireballs]]", equipped: true, state: { charges: { current: 4, max: 7 } } } as ItemEntry["entry"],
    })], rowCtx({ setItemCharges } as unknown as CharacterEditState));
    const checked = root.querySelectorAll<HTMLElement>(".archivist-toggle-box-checked");
    expect(checked.length).toBe(3);
    checked[1].click(); // decrement → newUsed = 2
    expect(setItemCharges).toHaveBeenCalledWith(0, 2, 7);
  });

  it("renders charge boxes from action.max_charges when entry has no state.charges", () => {
    const root = mountContainer();
    renderItems(root, [itemEntry({
      entity: { name: "Wand of Fireballs", rarity: "rare", actions: {} },
    })], rowCtx());
    const boxes = root.querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(7);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(0);
  });

  it("clicking a phantom-full pip seeds entry.state.charges via setItemCharges(idx, newUsed, max)", () => {
    const root = mountContainer();
    const setItemCharges = vi.fn();
    renderItems(root, [itemEntry({ index: 0 })], rowCtx({ setItemCharges } as unknown as CharacterEditState));
    const firstEmpty = root.querySelector<HTMLElement>(".archivist-toggle-box:not(.archivist-toggle-box-checked)")!;
    firstEmpty.click();
    expect(setItemCharges).toHaveBeenCalledWith(0, 1, 7);
  });

  it("clicking a row toggles .pc-row-open + the sibling expand IN PLACE (no container redraw)", () => {
    const root = mountContainer();
    renderItems(root, [itemEntry({ action: { cost: "action", range: "150 ft." } })], rowCtx());
    const row = root.querySelector(".pc-action-row") as HTMLElement;
    const expand = row.nextElementSibling as HTMLElement & { hidden: boolean };
    expect(expand.classList.contains("pc-action-expand")).toBe(true);
    expect(row.classList.contains("pc-row-open")).toBe(false);
    expect(expand.hidden).toBe(true);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // Same node survived the click → the container was not re-rendered.
    expect(root.querySelector(".pc-action-row")).toBe(row);
    expect(row.classList.contains("pc-row-open")).toBe(true);
    expect(expand.hidden).toBe(false);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-action-row")).toBe(row);
    expect(row.classList.contains("pc-row-open")).toBe(false);
    expect(expand.hidden).toBe(true);
  });

  it("renders rows as divs, not a <table>", () => {
    const root = mountContainer();
    renderItems(root, [itemEntry({ action: { cost: "action", range: "150 ft." } })], rowCtx());
    expect(root.querySelector("table")).toBeNull();
    expect(root.querySelector(".pc-action-row")?.tagName).toBe("DIV");
  });

  it("expands as a full-width sibling div carrying the open tint (hidden until clicked)", () => {
    const root = mountContainer();
    renderItems(root, [itemEntry({ action: { cost: "action", range: "150 ft." } })], rowCtx());
    const expand = root.querySelector(".pc-action-expand") as HTMLElement & { hidden: boolean };
    expect(expand).not.toBeNull();
    expect(expand.tagName).toBe("DIV");
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    expect(expand.hidden).toBe(true);
    (root.querySelector(".pc-action-row") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(expand.hidden).toBe(false);
    expect(root.querySelector("table")).toBeNull();
  });
});
