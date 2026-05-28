import { describe, it, expect } from "vitest";
import { visibleItems, type FilterState } from "../src/modules/pc/components/inventory/filter-state";
import type { EquipmentEntry, ResolvedEquipped } from "../src/modules/pc/pc.types";

const e = (
  item: string,
  opts: Partial<EquipmentEntry & { entity?: object | null; entityType?: string | null; rarity?: string; type?: string }> = {},
): { entry: EquipmentEntry; resolved: ResolvedEquipped } => {
  const entry = { item, equipped: opts.equipped, attuned: opts.attuned, qty: opts.qty, overrides: opts.overrides } as EquipmentEntry;
  const inline = opts.entity === null;
  const entity = opts.entity === undefined
    ? ({ name: nameFromSlug(item), type: opts.type, rarity: opts.rarity } as never)
    : (opts.entity as never);
  const entityType = opts.entityType !== undefined
    ? opts.entityType
    : (inline ? null : "item");
  return {
    entry,
    resolved: { index: 0, entity, entityType, entry } as ResolvedEquipped,
  };
};

function nameFromSlug(s: string): string {
  const m = s.match(/^\[\[(.+)\]\]$/);
  return m ? m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

const empty: FilterState = { status: "all", types: new Set(), rarities: new Set(), search: "" };

describe("visibleItems", () => {
  const items = [
    e("[[bracers-of-defense]]", { rarity: "uncommon", type: "wondrous" }),
    e("[[ring-of-evasion]]",    { rarity: "rare", type: "ring", attuned: true }),
    e("[[rapier]]",             { equipped: true, entity: { name: "Rapier" }, entityType: "weapon" }),
    e("50 ft of hempen rope",   { entity: null }), // inline
    e("[[potion-of-healing]]",  { rarity: "common", type: "potion", qty: 3 }),
  ];

  it("status=all returns everything alphabetized", () => {
    const out = visibleItems(items, empty);
    expect(out.map((i) => i.entry.item)).toEqual([
      "50 ft of hempen rope",
      "[[bracers-of-defense]]",
      "[[potion-of-healing]]",
      "[[rapier]]",
      "[[ring-of-evasion]]",
    ]);
  });

  it("status=equipped filters to only equipped", () => {
    const out = visibleItems(items, { ...empty, status: "equipped" });
    expect(out.map((i) => i.entry.item)).toEqual(["[[rapier]]"]);
  });

  it("status=attuned filters to only attuned", () => {
    const out = visibleItems(items, { ...empty, status: "attuned" });
    expect(out.map((i) => i.entry.item)).toEqual(["[[ring-of-evasion]]"]);
  });

  it("status=carried filters out equipped AND attuned", () => {
    const out = visibleItems(items, { ...empty, status: "carried" });
    expect(out.map((i) => i.entry.item)).toEqual([
      "50 ft of hempen rope",
      "[[bracers-of-defense]]",
      "[[potion-of-healing]]",
    ]);
  });

  it("type filter matches entity.type or entityType", () => {
    const out = visibleItems(items, { ...empty, types: new Set(["weapon"]) });
    expect(out.map((i) => i.entry.item)).toEqual(["[[rapier]]"]);
  });

  it("rarity filter intersects, skips inline + non-rarity entities", () => {
    const out = visibleItems(items, { ...empty, rarities: new Set(["rare"]) });
    expect(out.map((i) => i.entry.item)).toEqual(["[[ring-of-evasion]]"]);
  });

  it("search narrows by case-insensitive substring against display name", () => {
    const out = visibleItems(items, { ...empty, search: "ring" });
    expect(out.map((i) => i.entry.item)).toEqual(["[[ring-of-evasion]]"]);
  });

  it("override name wins for sort and search", () => {
    const items2 = [
      e("[[longsword]]", { overrides: { name: "Oathkeeper" } }),
      e("[[shortsword]]"),
    ];
    const out = visibleItems(items2, empty);
    expect(out.map((i) => i.entry.overrides?.name ?? i.entry.item)).toEqual([
      "Oathkeeper",
      "[[shortsword]]",
    ]);
  });

  it("sort is stable for ties", () => {
    const a = e("Apple");
    const b = e("Apple");
    const out = visibleItems([a, b], empty);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });
});
