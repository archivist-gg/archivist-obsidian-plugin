import { describe, it, expect } from "vitest";
import { ITEM_ACTIONS, type ItemAction } from "../src/modules/item/item.actions-map";

describe("ITEM_ACTIONS curated map", () => {
  it("includes wand-of-fireballs with 7 charges and dawn 1d6+1 recovery", () => {
    const a = ITEM_ACTIONS["wand-of-fireballs"];
    expect(a).toBeDefined();
    expect(a.cost).toBe("action");
    expect(a.range).toBe("150 ft.");
    expect(a.max_charges).toBe(7);
    expect(a.recovery).toEqual({ amount: "1d6+1", reset: "dawn" });
  });

  it("includes boots-of-speed (bonus-action, self, 1 use, long rest)", () => {
    const a = ITEM_ACTIONS["boots-of-speed"];
    expect(a.cost).toBe("bonus-action");
    expect(a.range).toBe("self");
    expect(a.max_charges).toBe(1);
    expect(a.recovery).toEqual({ amount: "1", reset: "long" });
  });

  it("includes ring-of-three-wishes (special recovery)", () => {
    const a = ITEM_ACTIONS["ring-of-three-wishes"];
    expect(a.recovery?.reset).toBe("special");
  });

  it("ItemAction type structure compiles", () => {
    const a: ItemAction = { cost: "free", range: undefined, max_charges: undefined, recovery: undefined };
    expect(a.cost).toBe("free");
  });
});

import { resolveItemAction } from "../src/modules/item/item.actions-map";
import type { EquipmentEntry } from "../src/modules/pc/pc.types";

describe("resolveItemAction priority", () => {
  it("returns null when no override and slug not in map", () => {
    const entry = { item: "[[mundane-rope]]" } as EquipmentEntry;
    expect(resolveItemAction("mundane-rope", entry)).toBeNull();
  });

  it("returns curated map entry when slug matches and no override", () => {
    const entry = { item: "[[wand-of-fireballs]]" } as EquipmentEntry;
    const a = resolveItemAction("wand-of-fireballs", entry);
    expect(a?.cost).toBe("action");
    expect(a?.range).toBe("150 ft.");
  });

  it("override.action+range wins over curated map", () => {
    const entry = {
      item: "[[wand-of-fireballs]]",
      overrides: { action: "bonus-action", range: "60 ft." },
    } as EquipmentEntry;
    const a = resolveItemAction("wand-of-fireballs", entry);
    expect(a?.cost).toBe("bonus-action");
    expect(a?.range).toBe("60 ft.");
    expect(a?.max_charges).toBe(7);
  });

  it("override.action without curated map base produces ItemAction with override only", () => {
    const entry = {
      item: "[[homebrew-thing]]",
      overrides: { action: "reaction", range: "30 ft." },
    } as EquipmentEntry;
    const a = resolveItemAction("homebrew-thing", entry);
    expect(a?.cost).toBe("reaction");
    expect(a?.range).toBe("30 ft.");
    expect(a?.max_charges).toBeUndefined();
  });
});
