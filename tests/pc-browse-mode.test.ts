/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { BrowseMode } from "../packages/obsidian/src/modules/pc/components/inventory/browse-mode";
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
  equipment: [],
  overrides: {},
  state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
});

function ctxWithRegistry(
  registry: Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>,
  editState: object | null = null,
): ComponentRenderContext {
  const c = baseChar();
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], spells: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3 } as DerivedStats,
    services: {
      entities: {
        getBySlug: (slug: string) => registry.get(slug) ?? null,
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

const FILTERS = { status: "all" as const, types: new Set<string>(), rarities: new Set<string>(), search: "" };

describe("BrowseMode select-callback mode", () => {
  it("onSelect mode: the row action calls onSelect(slug) and does NOT call addItem", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword" } }],
    ]);
    const addItem = vi.fn();
    const onSelect = vi.fn();
    const root = mountContainer();
    new BrowseMode({ filters: FILTERS, onSelect })
      .render(root, ctxWithRegistry(reg, { addItem }));
    (root.querySelector(".pc-inv-add-mini") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith("longsword");
    expect(addItem).not.toHaveBeenCalled();
  });

  it("default mode (no onSelect): the row action still calls addItem", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword" } }],
    ]);
    const addItem = vi.fn();
    const root = mountContainer();
    new BrowseMode({ filters: FILTERS })
      .render(root, ctxWithRegistry(reg, { addItem }));
    (root.querySelector(".pc-inv-add-mini") as HTMLElement).click();
    expect(addItem).toHaveBeenCalledWith("longsword", {});
  });

  it("categoryScope narrows candidates to the matching item type", () => {
    const reg = new Map<string, { entityType: string; data: { name?: string; [k: string]: unknown } }>([
      ["longsword", { entityType: "weapon", data: { name: "Longsword" } }],
      ["potion-of-healing", { entityType: "item", data: { name: "Potion of Healing", type: "potion" } }],
      ["oil-of-sharpness", { entityType: "item", data: { name: "Oil of Sharpness", type: "potion" } }],
    ]);
    const root = mountContainer();
    new BrowseMode({ filters: FILTERS, categoryScope: "potion", onSelect: vi.fn() })
      .render(root, ctxWithRegistry(reg, {}));
    const names = [...root.querySelectorAll(".pc-inv-name")].map((n) => n.textContent);
    expect(names).toEqual(["Oil of Sharpness", "Potion of Healing"]);
  });
});
