/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryTab } from "../src/modules/pc/components/inventory-tab";
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

function ctxWith(c: Character, derivedOverrides: Partial<DerivedStats> = {}): ComponentRenderContext {
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3, ...derivedOverrides } as DerivedStats,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("InventoryTab (redesigned)", () => {
  it("renders the header strip (attune + divider + currency)", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    expect(root.querySelector(".pc-inventory-header .pc-header-strip")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-attune")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-divider")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-currency")).toBeTruthy();
    expect(root.querySelector(".pc-loadout-slot")).toBeNull();
  });

  it("renders toolbar with search and Add Item button", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    expect(root.querySelector(".pc-inv-search input")).toBeTruthy();
    expect(root.querySelector(".pc-inv-add")).toBeTruthy();
  });

  it("renders three filter chip groups", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    const labels = [...root.querySelectorAll(".pc-inv-filter-group-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Status", "Type", "Rarity"]);
  });

  it("renders empty-state message when no equipment", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    expect(root.querySelector(".pc-inv-empty")?.textContent).toMatch(/no items/i);
  });

  it("renders alphabetical rows for each equipment entry", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]" }, { item: "[[plate]]" }];
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c));
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(2);
  });

  it("currency strip renders all 5 coins", () => {
    const c = baseChar();
    c.currency = { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 };
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c));
    expect(root.querySelectorAll(".pc-currency-cell")).toHaveLength(5);
  });

  it("renders carried-weight + count in heading", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[a]]" }, { item: "[[b]]" }];
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, { carriedWeight: 12.5 }));
    expect(root.querySelector(".pc-inv-meta-suffix")?.textContent).toMatch(/2 items/);
    expect(root.querySelector(".pc-inv-meta-suffix")?.textContent).toMatch(/12\.5/);
  });

  it("renders attunement strip with N medallions matching attunementLimit", () => {
    const c = baseChar();
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, { attunementLimit: 3 }));
    expect(root.querySelectorAll(".pc-medallion")).toHaveLength(3);
    expect(root.querySelector(".pc-attune-count")?.textContent).toMatch(/0\s*\/\s*3/);
  });

  it("clicking Add Item switches to browse mode and shows Done", () => {
    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(baseChar()));
    expect(root.querySelector(".pc-inv-add")).toBeTruthy();
    expect(root.querySelector(".pc-inv-done")).toBeNull();
    (root.querySelector(".pc-inv-add") as HTMLElement).click();
    expect(root.querySelector(".pc-inv-done")).toBeTruthy();
    expect(root.querySelector(".pc-inv-browse-banner")).toBeTruthy();
    (root.querySelector(".pc-inv-done") as HTMLElement).click();
    expect(root.querySelector(".pc-inv-add")).toBeTruthy();
    expect(root.querySelector(".pc-inv-browse-banner")).toBeNull();
  });

  it("clicking the same Type chip twice toggles it on then off (filters re-render)", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[longsword]]" },
      { item: "[[plate]]" },
    ];
    const root = mountContainer();
    // Provide a getBySlug that classifies longsword as a weapon and plate as armor.
    const ctx: ComponentRenderContext = {
      resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
      derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed: 0, attunementLimit: 3 } as DerivedStats,
      core: {
        entities: {
          getBySlug: (slug: string) => {
            if (slug === "longsword") return { entityType: "weapon", data: { name: "Longsword", type: "weapon" } };
            if (slug === "plate")     return { entityType: "armor",  data: { name: "Plate",     type: "armor"  } };
            return null;
          },
        },
      } as never,
      app: {} as never,
      editState: null,
    };
    new InventoryTab().render(root, ctx);

    // Sanity: both rows show before any filter is applied.
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(2);

    const findChip = (label: string): HTMLElement =>
      [...root.querySelectorAll(".pc-inv-chip")].find((c) => c.textContent?.toLowerCase().includes(label)) as HTMLElement;

    // First click: select Weapons. Chip becomes active; only the weapon row remains.
    const weaponChip1 = findChip("weapons");
    expect(weaponChip1).toBeTruthy();
    weaponChip1.click();
    const weaponChip2 = findChip("weapons"); // re-query: filters re-render replaces nodes
    expect(weaponChip2.classList.contains("active")).toBe(true);
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(1);

    // Second click on the SAME chip: should deselect. Chip no longer active; both rows return.
    weaponChip2.click();
    const weaponChip3 = findChip("weapons");
    expect(weaponChip3.classList.contains("active")).toBe(false);
    expect(root.querySelectorAll(".pc-inv-row")).toHaveLength(2);
  });
});

describe("InventoryTab — full integration", () => {
  it("renders header / toolbar / filters / list / attunement strip / currency strip together", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[longsword]]", equipped: true },
      { item: "[[plate]]" },
      { item: "[[ring-of-evasion]]", attuned: true },
      { item: "50 ft of hempen rope" },
    ];
    c.currency = { pp: 0, gp: 24, ep: 0, sp: 5, cp: 0 };

    const root = mountContainer();
    new InventoryTab().render(root, ctxWith(c, { ac: 14, carriedWeight: 24, attunementUsed: 1, attunementLimit: 3 }));

    // Header — attunement (3 medallions) + divider + currency (no loadout slots)
    expect(root.querySelector(".pc-header-strip")).toBeTruthy();
    expect(root.querySelectorAll(".pc-medallion")).toHaveLength(3);
    expect(root.querySelector(".pc-header-divider")).toBeTruthy();
    expect(root.querySelectorAll(".pc-loadout-slot")).toHaveLength(0);

    // Toolbar — search input + Add Item button
    expect(root.querySelector(".pc-inv-search input")).toBeTruthy();
    expect(root.querySelector(".pc-inv-add")).toBeTruthy();

    // Filter chip groups (Status + Type + Rarity in list mode)
    expect([...root.querySelectorAll(".pc-inv-filter-group-label")].map((l) => l.textContent))
      .toEqual(["Status", "Type", "Rarity"]);

    // List rows — one per equipment entry
    expect(root.querySelectorAll(".pc-inv-row").length).toBe(4);

    // Currency strip — all 5 coins
    expect(root.querySelectorAll(".pc-currency-cell")).toHaveLength(5);

    // Carried-weight in heading
    expect(root.querySelector(".pc-inv-meta-suffix")?.textContent).toMatch(/24/);
  });
});
