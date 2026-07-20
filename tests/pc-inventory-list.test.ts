/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryList } from "../packages/obsidian/src/modules/pc/components/inventory/inventory-list";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { Character, ResolvedCharacter, DerivedStats, EquippedSlots } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const baseChar = (): Character => ({
  name: "T", edition: "2014", race: null, subrace: null, background: null,
  class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [
    { item: "[[ring-of-evasion]]" },
    { item: "[[bracers-of-defense]]" },
    { item: "50 ft of hempen rope" },
    { item: "[[rapier]]", equipped: true },
  ],
  overrides: {},
  state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
});

function ctx(c: Character): ComponentRenderContext {
  return {
    resolved: {
      definition: c,
      race: null, classes: [], background: null, feats: [],
      totalLevel: 1, features: [], spells: [], state: c.state,
    } as ResolvedCharacter,
    derived: {
      ac: 0, acBreakdown: [], attacks: [],
      equippedSlots: {} as EquippedSlots,
      carriedWeight: 0, attunementUsed: 0, attunementLimit: 3,
    } as DerivedStats,
    // Production registry path: ctx.services.entities.getBySlug(...)
    // (PCServices.entities is the EntityRegistry directly — no `.registry` sublevel.)
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("InventoryList", () => {
  it("renders rows alphabetically by display name", () => {
    const root = mountContainer();
    new InventoryList().render(root, ctx(baseChar()));
    const names = [...root.querySelectorAll(".pc-inv-name")].map((n) => n.textContent);
    expect(names).toEqual(["50 ft of hempen rope", "Bracers Of Defense", "Rapier", "Ring Of Evasion"]);
  });

  it("renders empty-state message when there are no items", () => {
    const c = baseChar();
    c.equipment = [];
    const root = mountContainer();
    new InventoryList().render(root, ctx(c));
    expect(root.querySelector(".pc-inv-empty")).toBeTruthy();
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(0);
  });

  it("clicking a row expands it inline (sibling .pc-inv-expand appears)", () => {
    const root = mountContainer();
    new InventoryList().render(root, ctx(baseChar()));
    const firstRow = root.querySelector(".pc-inv-row") as HTMLElement;
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(0);
    firstRow.click();
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(1);
  });

  it("clicking the same row again collapses it", () => {
    const root = mountContainer();
    new InventoryList().render(root, ctx(baseChar()));
    const firstRow = root.querySelector(".pc-inv-row") as HTMLElement;
    firstRow.click();
    firstRow.click();
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(0);
  });

  it("multiple rows can be expanded simultaneously", () => {
    const root = mountContainer();
    new InventoryList().render(root, ctx(baseChar()));
    const rows = root.querySelectorAll(".pc-inv-row");
    (rows[0] as HTMLElement).click();
    (rows[1] as HTMLElement).click();
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(2);
  });

  it("caps at 50 rows and shows a Load more button that reveals 50 more", () => {
    const c = baseChar();
    // 120 items → 50 shown, Load more (70) → 100 shown, Load more (20) → all 120, button gone.
    c.equipment = Array.from({ length: 120 }, (_, i) => ({
      item: `[[item-${String(i).padStart(3, "0")}]]`,
    }));
    const root = mountContainer();
    // builderUiState present so the shown-count persists across the load-more repaints.
    new InventoryList().render(root, { ...ctx(c), builderUiState: new Map() });

    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(50);
    const btn = root.querySelector(".pc-inv-loadmore-btn") as HTMLElement | null;
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toBe("Load more (70)");

    btn!.click();
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(100);
    const btn2 = root.querySelector(".pc-inv-loadmore-btn") as HTMLElement;
    expect(btn2.textContent).toBe("Load more (20)");

    btn2.click();
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(120);
    expect(root.querySelector(".pc-inv-loadmore-btn")).toBeNull();
  });

  it("shown-count survives a re-render for the same filters (persisted in builderUiState)", () => {
    const c = baseChar();
    c.equipment = Array.from({ length: 120 }, (_, i) => ({
      item: `[[item-${String(i).padStart(3, "0")}]]`,
    }));
    const bag = new Map<string, unknown>();
    const root = mountContainer();
    new InventoryList().render(root, { ...ctx(c), builderUiState: bag });
    (root.querySelector(".pc-inv-loadmore-btn") as HTMLElement).click();
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(100);

    // Simulate a mutation re-render: same bag + same filters → count is retained.
    const root2 = mountContainer();
    new InventoryList().render(root2, { ...ctx(c), builderUiState: bag });
    expect(root2.querySelectorAll(".pc-inv-row")).toHaveLength(100);
  });

  it("does not render a Load more button when 50 or fewer items match", () => {
    const c = baseChar();
    c.equipment = Array.from({ length: 50 }, (_, i) => ({
      item: `[[item-${String(i).padStart(3, "0")}]]`,
    }));
    const root = mountContainer();
    new InventoryList().render(root, { ...ctx(c), builderUiState: new Map() });
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(50);
    expect(root.querySelector(".pc-inv-loadmore-btn")).toBeNull();
  });

  it("uses entity data when registry has a matching slug", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]" }];
    const longsword = { name: "Longsword of Sharpness", rarity: "rare" };
    const root = mountContainer();
    new InventoryList().render(root, {
      ...ctx(c),
      services: { entities: { getBySlug: (slug: string) => slug === "longsword" ? { entityType: "item", data: longsword } : null } } as never,
    });
    const name = root.querySelector(".pc-inv-name");
    expect(name?.textContent).toBe("Longsword of Sharpness");
    expect(name?.classList.contains("rarity-rare")).toBe(true);
  });
});
