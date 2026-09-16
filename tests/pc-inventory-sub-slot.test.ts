/** @vitest-environment jsdom */
/**
 * R4-G7 T8 RIDER-29 (F-INVSUB, found live in W-A2 `shots/W-A2-green/illrigger-probe/panel-inventory__2.png`) · the inventory
 * sub-line omits the equipped SLOT when it names the same word as the item TYPE.
 *
 * The user's Plate Armor read "Equipped · armor · Armor": the slot is `armor` and the armor document carries no `type`, so the
 * type part is the armor arm's `armor`. The rule compares the two DATA values case-insensitively (the slot as written, the
 * type value the sub-line prints) and never consults a word list.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { InventoryRow } from "../packages/obsidian/src/modules/pc/components/inventory/inventory-row";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function subFor(entity: object, entityType: string, entry: Partial<EquipmentEntry>): string {
  const e = { item: "[[x]]", ...entry } as EquipmentEntry;
  const root = mountContainer();
  new InventoryRow().render(root, {
    entry: e, resolved: { index: 0, entity: entity as never, entityType, entry: e } as ResolvedEquipped, app: {} as never, editState: null,
  });
  return root.querySelector(".pc-inv-sub")?.textContent ?? "";
}

describe("RIDER-29 · the slot part is omitted when it equals the type", () => {
  it("Plate Armor in the armor slot, with no authored type, reads Equipped · Armor", () => {
    expect(subFor({ name: "Plate Armor", category: "heavy" }, "armor", { equipped: true, slot: "armor" })).toBe("Equipped · Armor");
  });

  it("the compare is case-insensitive over the two data values (an authored type ARMOR)", () => {
    expect(subFor({ name: "Odd Armor", type: "ARMOR" }, "armor", { equipped: true, slot: "armor" })).toBe("Equipped · ARMOR");
  });

  it("control: a slot that differs from the type keeps both parts", () => {
    expect(subFor({ name: "Shield", type: "shield_armor" }, "armor", { equipped: true, slot: "shield" })).toBe("Equipped · shield · Shield Armor");
    expect(subFor({ name: "Longsword", type: "martial_melee" }, "weapon", { equipped: true, slot: "mainhand" })).toBe("Equipped · mainhand · Martial Melee");
  });
});
