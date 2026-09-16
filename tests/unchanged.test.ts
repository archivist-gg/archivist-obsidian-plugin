import { describe, it, expect } from "vitest";
import { isUnchanged } from "../packages/obsidian/src/shared/edit/unchanged";

describe("isUnchanged (R4-G6b §4.1)", () => {
  it("ignores key order and undefined-valued keys; arrays are ordered; NaN never equal; null and undefined differ", () => {
    expect(isUnchanged({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(isUnchanged({ a: 1, c: undefined }, { a: 1 })).toBe(true);
    expect(isUnchanged({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(isUnchanged({ a: NaN }, { a: NaN })).toBe(false);
    expect(isUnchanged({ a: null }, { a: undefined })).toBe(false);
    expect(isUnchanged({ a: { b: "x" } }, { a: { b: "y" } })).toBe(false);
  });
});
