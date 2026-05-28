/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryList } from "../src/modules/pc/components/inventory/inventory-list";
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
      totalLevel: 1, features: [], state: c.state,
    } as ResolvedCharacter,
    derived: {
      ac: 0, acBreakdown: [], attacks: [],
      equippedSlots: {} as EquippedSlots,
      carriedWeight: 0, attunementUsed: 0, attunementLimit: 3,
    } as DerivedStats,
    // Production registry path: ctx.core.entities.getBySlug(...)
    // (CoreAPI.entities is the EntityRegistry directly — no `.registry` sublevel.)
    core: { entities: { getBySlug: () => null } } as never,
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

  it("uses entity data when registry has a matching slug", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]" }];
    const longsword = { name: "Longsword of Sharpness", rarity: "rare" };
    const root = mountContainer();
    new InventoryList().render(root, {
      ...ctx(c),
      core: { entities: { getBySlug: (slug: string) => slug === "longsword" ? { entityType: "item", data: longsword } : null } } as never,
    });
    const name = root.querySelector(".pc-inv-name");
    expect(name?.textContent).toBe("Longsword of Sharpness");
    expect(name?.classList.contains("rarity-rare")).toBe(true);
  });
});
