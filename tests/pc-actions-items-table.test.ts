/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ItemsTable } from "../src/modules/pc/components/actions/items-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { CharacterEditState } from "../src/modules/pc/pc.edit-state";

beforeAll(() => installObsidianDomHelpers());

function ctx(opts: { entries: object[]; entityForSlug: (slug: string) => object | null; editState?: CharacterEditState | null }): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: opts.entries } } as never,
    derived: { attacks: [] } as never,
    core: { entities: { getBySlug: (slug: string) => {
      const data = opts.entityForSlug(slug);
      return data ? { entityType: "item", data } : null;
    } } } as never,
    app: {} as never,
    editState: opts.editState ?? null,
  };
}

describe("ItemsTable", () => {
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

  it("renders charge boxes when item has charges", () => {
    const root = mountContainer();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, attuned: true, state: { charges: { current: 5, max: 7 } } }],
      entityForSlug: () => ({ name: "Wand of Fireballs", rarity: "very rare", actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } } }),
    }));
    const boxes = root.querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(7);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(2);
  });

  it("clicking pip dispatches editState.setItemCharges with legendary semantics", () => {
    const root = mountContainer();
    const setItemCharges = vi.fn();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, state: { charges: { current: 7, max: 7 } } }],
      entityForSlug: () => ({ name: "Wand of Fireballs", actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } } }),
      editState: { setItemCharges } as unknown as CharacterEditState,
    }));
    const firstEmpty = root.querySelector<HTMLElement>(".archivist-toggle-box:not(.archivist-toggle-box-checked)")!;
    firstEmpty.click();
    expect(setItemCharges).toHaveBeenCalledWith(0, 1, 7);
  });

  it("clicking checked box decrements via setItemCharges", () => {
    const root = mountContainer();
    const setItemCharges = vi.fn();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, state: { charges: { current: 4, max: 7 } } }],
      entityForSlug: () => ({ name: "Wand of Fireballs", actions: { cost: "action", range: "150 ft.", max_charges: 7 } }),
      editState: { setItemCharges } as unknown as CharacterEditState,
    }));
    const checked = root.querySelectorAll<HTMLElement>(".archivist-toggle-box-checked");
    expect(checked.length).toBe(3);
    checked[1].click(); // decrement → newUsed = 2
    expect(setItemCharges).toHaveBeenCalledWith(0, 2, 7);
  });

  it("renders charge boxes from action.max_charges when entry has no state.charges", () => {
    const root = mountContainer();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, attuned: true }],
      entityForSlug: () => ({
        name: "Wand of Fireballs", rarity: "rare",
        actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
      }),
    }));
    const boxes = root.querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(7);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(0);
  });

  it("clicking a phantom-full pip seeds entry.state.charges via setItemCharges(idx, newUsed, max)", () => {
    const root = mountContainer();
    const setItemCharges = vi.fn();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, attuned: true }],
      entityForSlug: () => ({ name: "Wand of Fireballs", actions: { cost: "action", range: "150 ft.", max_charges: 7 } }),
      editState: { setItemCharges } as unknown as CharacterEditState,
    }));
    const firstEmpty = root.querySelector<HTMLElement>(".archivist-toggle-box:not(.archivist-toggle-box-checked)")!;
    firstEmpty.click();
    expect(setItemCharges).toHaveBeenCalledWith(0, 1, 7);
  });
});
