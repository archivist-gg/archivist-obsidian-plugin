import { describe, it, expect } from "vitest";
import {
  isUnidentifiedPlaceholder,
  isScrollItem,
} from "../packages/obsidian/src/modules/pc/components/inventory/item-predicates";

// Carry-forward from T3: `isItemEntity` is `"rarity" in e`: a leaky
// "is-a-magic-item" guard. Unidentified placeholders carry NO `rarity`, so a
// rarity gate would wrongly reject them. These predicates are value-based and
// read the marker field directly.
describe("isUnidentifiedPlaceholder", () => {
  it("true when the unidentified marker is set", () => {
    expect(isUnidentifiedPlaceholder({ unidentified: true })).toBe(true);
  });

  it("false for a normal magic item (WITH rarity, WITHOUT unidentified): proves no rarity gate", () => {
    expect(isUnidentifiedPlaceholder({ name: "Ring of Protection", rarity: "rare" })).toBe(false);
  });

  it("false when unidentified is explicitly false", () => {
    expect(isUnidentifiedPlaceholder({ unidentified: false })).toBe(false);
  });

  it("false for null / undefined / non-object", () => {
    expect(isUnidentifiedPlaceholder(null)).toBe(false);
    expect(isUnidentifiedPlaceholder(undefined)).toBe(false);
    expect(isUnidentifiedPlaceholder("nope")).toBe(false);
  });
});

describe("isScrollItem", () => {
  it("true when scroll_level is present", () => {
    expect(isScrollItem({ scroll_level: 3 })).toBe(true);
  });

  it("true for a cantrip scroll (scroll_level 0)", () => {
    expect(isScrollItem({ scroll_level: 0 })).toBe(true);
  });

  it("false when scroll_level is absent (a normal item WITH rarity)", () => {
    expect(isScrollItem({ name: "Potion of Healing", rarity: "common" })).toBe(false);
  });

  it("false for null / non-object", () => {
    expect(isScrollItem(null)).toBe(false);
    expect(isScrollItem(undefined)).toBe(false);
  });
});
