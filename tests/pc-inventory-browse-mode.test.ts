/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { BrowseMode } from "../src/modules/pc/components/inventory/browse-mode";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { Character, ResolvedCharacter, DerivedStats, EquippedSlots } from "../src/modules/pc/pc.types";

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

function ctxWithRegistry(registry: Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>, editState: object | null = null): ComponentRenderContext {
  const c = baseChar();
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3 } as DerivedStats,
    core: {
      entities: {
        getBySlug: (slug: string) => registry.get(slug) ?? null,
        // Real EntityRegistry has no `getAllByType` — closest API is `search(query, entityType, limit)`
        // which returns all entries of a type when query is empty. The implementation uses that.
        search: (_query: string, type: string | undefined, _limit: number) =>
          [...registry.entries()]
            .filter(([_, v]) => !type || v.entityType === type)
            .map(([slug, v]) => ({ slug, name: v.data.name ?? slug, entityType: v.entityType, data: v.data })),
      },
    } as never,
    app: {} as never,
    editState: editState as never,
  };
}

describe("BrowseMode", () => {
  it("lists items from the compendium registry", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword", category: "martial-melee", damage: { dice: "1d8" } } }],
      ["plate", { entityType: "armor", data: { name: "Plate", category: "heavy", ac: { base: 18 } } }],
      ["potion-of-healing", { entityType: "item", data: { name: "Potion of Healing", type: "potion" } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } }).render(root, ctxWithRegistry(reg));
    expect(root.querySelectorAll(".pc-inv-row").length).toBe(3);
  });

  it("filter by type narrows the list", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword" } }],
      ["plate", { entityType: "armor", data: { name: "Plate" } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(["weapon"]), rarities: new Set(), search: "" } }).render(root, ctxWithRegistry(reg));
    expect([...root.querySelectorAll(".pc-inv-name")].map((n) => n.textContent)).toEqual(["Longsword"]);
  });

  it("clicking + Add on a row calls editState.addItem with the slug", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword" } }],
    ]);
    const addItem = vi.fn();
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(reg, { addItem }));
    (root.querySelector(".pc-inv-add-mini") as HTMLElement).click();
    expect(addItem).toHaveBeenCalledWith("longsword");
  });

  it("renders the custom-item input strip", () => {
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(new Map(), { addItem: vi.fn() }));
    expect(root.querySelector(".pc-inv-custom-input")).toBeTruthy();
  });

  it("clicking a row expands it inline (sibling .pc-inv-expand appears)", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(reg, { addItem: vi.fn() }));
    const firstRow = root.querySelector(".pc-inv-row") as HTMLElement;
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(0);
    firstRow.click();
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(1);
  });

  it("clicking the same row again collapses it", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(reg, { addItem: vi.fn() }));
    const firstRow = root.querySelector(".pc-inv-row") as HTMLElement;
    firstRow.click();
    firstRow.click();
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(0);
  });

  it("clicking the + Add button does NOT toggle expand", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } } }],
    ]);
    const addItem = vi.fn();
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(reg, { addItem }));
    (root.querySelector(".pc-inv-add-mini") as HTMLElement).click();
    expect(addItem).toHaveBeenCalledWith("longsword");
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(0);
  });

  it("multiple rows can be expanded simultaneously", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } } }],
      ["plate", { entityType: "armor", data: { name: "Plate", category: "heavy", ac: { base: 18 } } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(reg, { addItem: vi.fn() }));
    const rows = root.querySelectorAll(".pc-inv-row");
    (rows[0] as HTMLElement).click();
    (rows[1] as HTMLElement).click();
    expect(root.querySelectorAll(".pc-inv-expand")).toHaveLength(2);
  });

  it("expanded row shows entity block (no PC actions strip)", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword", category: "martial-melee", damage: { dice: "1d8", type: "slashing" } } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: { status: "all", types: new Set(), rarities: new Set(), search: "" } })
      .render(root, ctxWithRegistry(reg, { addItem: vi.fn() }));
    const firstRow = root.querySelector(".pc-inv-row") as HTMLElement;
    firstRow.click();
    expect(root.querySelector(".pc-inv-expand")).toBeTruthy();
    // No equip / remove / attune buttons in browse mode
    expect(root.querySelector(".pc-inv-actions")).toBeFalsy();
  });
});
