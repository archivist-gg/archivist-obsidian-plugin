/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryTab } from "../src/modules/pc/components/inventory-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function mkResolved(): ResolvedCharacter {
  const state = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], currency: { cp: 5, sp: 10, ep: 0, gp: 42, pp: 2 } };
  return {
    definition: {
      name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual",
      skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] },
      equipment: [
        { item: "[[shortsword]]", equipped: true },
        { item: "Rope (50 ft.)", qty: 1 },
        { item: "[[cloak-of-elvenkind]]", equipped: true, attuned: true },
      ],
      overrides: {}, state,
    } as never,
    race: null, classes: [], background: null, feats: [], totalLevel: 0, features: [], state,
  };
}

const ctx: ComponentRenderContext = { resolved: mkResolved(), derived: {} as DerivedStats, core: {} as never, editState: null };

describe("InventoryTab", () => {
  it("renders equipped badge for equipped items", () => {
    const container = mountContainer();
    new InventoryTab().render(container, ctx);
    const items = container.querySelectorAll(".pc-inventory-item");
    expect(items.length).toBe(3);
    const shortsword = [...items].find((i) => i.textContent?.includes("Shortsword"));
    expect(shortsword?.querySelector(".pc-item-equipped")).not.toBeNull();
  });
  it("renders attuned badge on attuned items", () => {
    const container = mountContainer();
    new InventoryTab().render(container, ctx);
    const cloak = [...container.querySelectorAll(".pc-inventory-item")].find((i) => i.textContent?.includes("Cloak"));
    expect(cloak?.querySelector(".pc-item-attuned")).not.toBeNull();
  });
  it("prettifies slug names; leaves literal names as-is", () => {
    const container = mountContainer();
    new InventoryTab().render(container, ctx);
    const names = [...container.querySelectorAll(".pc-item-name")].map((n) => n.textContent);
    expect(names).toContain("Shortsword");
    expect(names).toContain("Rope (50 ft.)");
  });
  it("renders 5 currency cells", () => {
    const container = mountContainer();
    new InventoryTab().render(container, ctx);
    expect(container.querySelectorAll(".pc-currency-cell").length).toBe(5);
    const gp = [...container.querySelectorAll(".pc-currency-cell")].find((c) => c.textContent?.includes("GP"));
    expect(gp?.querySelector(".pc-currency-val")?.textContent).toBe("42");
  });
});
