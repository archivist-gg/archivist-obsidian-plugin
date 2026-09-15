/** @vitest-environment jsdom */
/**
 * R4-G7 T8 RIDER-24 (F-ITEMS, inv-3 §7) · the Inventory heading's count agrees with its noun: "1 item", "N items".
 * The count is still the number of equipment ENTRIES (a `dagger qty: 2` entry is one item), exactly as before; only the
 * noun changed, because a character holding one entry read "INVENTORY 1 ITEMS" (13 of 127 S01 rows).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryTab } from "../packages/obsidian/src/modules/pc/components/inventory-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { Character, DerivedStats, EquipmentEntry, EquippedSlots, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function suffixFor(equipment: EquipmentEntry[]): string {
  const c = {
    name: "T", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual",
    skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] }, equipment, overrides: {},
    state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
  } as unknown as Character;
  const ctx = {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], spells: [], state: c.state } as unknown as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 1, attunementUsed: 0, attunementLimit: 3 } as unknown as DerivedStats,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  } as ComponentRenderContext;
  const root = mountContainer();
  new InventoryTab().render(root, ctx);
  return root.querySelector(".pc-inv-meta-suffix")?.textContent ?? "";
}

describe("RIDER-24 · the Inventory count noun agrees with the count", () => {
  it("one entry reads 1 item, even when that entry carries a quantity of 2", () => {
    expect(suffixFor([{ item: "[[dagger]]", qty: 2 } as EquipmentEntry])).toBe(" 1 item · 1 lb carried");
  });
  it("control: two entries read 2 items", () => {
    expect(suffixFor([{ item: "[[a]]" }, { item: "[[b]]" }] as EquipmentEntry[])).toBe(" 2 items · 1 lb carried");
  });
  it("no entries read 0 items", () => {
    expect(suffixFor([])).toBe(" 0 items · 1 lb carried");
  });
});
