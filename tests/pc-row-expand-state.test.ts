import { describe, it, expect } from "vitest";
import {
  rowExpandKey,
  isRowExpanded,
  setRowExpanded,
} from "../packages/obsidian/src/modules/pc/components/row-expand-state";

const ctxWith = (bag?: Map<string, unknown>) => ({ builderUiState: bag });

describe("rowExpandKey", () => {
  it("prefixes rowexpand. and colon-joins surface + parts", () => {
    expect(
      rowExpandKey("feature", "passive:class-features", "class", "fighter", "second-wind", 0),
    ).toBe("rowexpand.feature:passive:class-features:class:fighter:second-wind:0");
  });
  it("coerces null/undefined parts to empty strings for a stable key", () => {
    expect(rowExpandKey("spell", "prep", "fireball#")).toBe("rowexpand.spell:prep:fireball#");
    expect(rowExpandKey("inv", 3, null)).toBe("rowexpand.inv:3:");
    expect(rowExpandKey("inv", 3, undefined)).toBe("rowexpand.inv:3:");
  });
});

describe("isRowExpanded / setRowExpanded", () => {
  it("returns false and never throws when the bag is absent", () => {
    expect(isRowExpanded(ctxWith(undefined), "rowexpand.x")).toBe(false);
    expect(() => setRowExpanded(ctxWith(undefined), "rowexpand.x", true)).not.toThrow();
  });
  it("round-trips true and DELETES on false (keeps the bag small)", () => {
    const bag = new Map<string, unknown>();
    const ctx = ctxWith(bag);
    expect(isRowExpanded(ctx, "rowexpand.k")).toBe(false);
    setRowExpanded(ctx, "rowexpand.k", true);
    expect(bag.get("rowexpand.k")).toBe(true);
    expect(isRowExpanded(ctx, "rowexpand.k")).toBe(true);
    setRowExpanded(ctx, "rowexpand.k", false);
    expect(bag.has("rowexpand.k")).toBe(false); // deleted, not stored as false
    expect(isRowExpanded(ctx, "rowexpand.k")).toBe(false);
  });
  it("treats a non-true stored value as collapsed", () => {
    const bag = new Map<string, unknown>([["rowexpand.k", 3]]);
    expect(isRowExpanded(ctxWith(bag), "rowexpand.k")).toBe(false);
  });
});
