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

  it("includes necklace-of-fireballs (action, 60 ft., 9 max charges, no recovery)", () => {
    const a = ITEM_ACTIONS["necklace-of-fireballs"];
    expect(a).toBeDefined();
    expect(a.cost).toBe("action");
    expect(a.range).toBe("60 ft.");
    expect(a.max_charges).toBe(9);
    expect(a.recovery).toBeUndefined();
  });

  it("includes ring-of-evasion as a reaction (3 charges, dawn 1d3)", () => {
    const a = ITEM_ACTIONS["ring-of-evasion"];
    expect(a).toBeDefined();
    expect(a.cost).toBe("reaction");
    expect(a.range).toBe("self");
    expect(a.max_charges).toBe(3);
    expect(a.recovery).toEqual({ amount: "1d3", reset: "dawn" });
  });

  it.each([
    ["cube-of-force",            "action", "self",    36, { amount: "1d20",  reset: "dawn" }],
    ["gem-of-brightness",        "action", "60 ft.",  50, undefined],
    ["gem-of-seeing",            "action", "self",     3, { amount: "1d3",   reset: "dawn" }],
    ["helm-of-teleportation",    "action", "self",     3, { amount: "1d3",   reset: "dawn" }],
    ["medallion-of-thoughts",    "action", "30 ft.",   3, { amount: "1d3",   reset: "dawn" }],
    ["pipes-of-haunting",        "action", "30 ft.",   3, { amount: "1d3",   reset: "dawn" }],
    ["pipes-of-the-sewers",      "action", "self",     3, { amount: "1d3",   reset: "dawn" }],
    ["ring-of-animal-influence", "action", "self",     3, { amount: "1d3",   reset: "dawn" }],
    ["ring-of-elemental-command","action", "self",     5, { amount: "1d4+1", reset: "dawn" }],
    ["chime-of-opening",         "action", "120 ft.", 10, undefined],
    ["dust-of-disappearance",    "action", "self",     1, { amount: "0",     reset: "special" }],
  ] as const)(
    "includes %s with expected cost/range/charges/recovery",
    (slug, cost, range, maxCharges, recovery) => {
      const a = ITEM_ACTIONS[slug];
      expect(a).toBeDefined();
      expect(a.cost).toBe(cost);
      expect(a.range).toBe(range);
      expect(a.max_charges).toBe(maxCharges);
      if (recovery === undefined) {
        expect(a.recovery).toBeUndefined();
      } else {
        expect(a.recovery).toEqual(recovery);
      }
    },
  );
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
