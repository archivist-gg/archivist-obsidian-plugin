import { describe, it, expect } from "vitest";
import { isEmpty } from "../../tools/srd-canonical/audit-merger-gaps";

describe("isEmpty", () => {
  it("string: null/undefined/empty-string are empty", () => {
    expect(isEmpty(null, "string")).toBe(true);
    expect(isEmpty(undefined, "string")).toBe(true);
    expect(isEmpty("", "string")).toBe(true);
    expect(isEmpty("longsword", "string")).toBe(false);
  });

  it("number: null/undefined are empty; 0 and positives are NOT", () => {
    expect(isEmpty(null, "number")).toBe(true);
    expect(isEmpty(undefined, "number")).toBe(true);
    expect(isEmpty(0, "number")).toBe(false);
    expect(isEmpty(3, "number")).toBe(false);
  });

  it("cost: also treats '0.00' as empty", () => {
    expect(isEmpty("0.00", "cost")).toBe(true);
    expect(isEmpty("", "cost")).toBe(true);
    expect(isEmpty(null, "cost")).toBe(true);
    expect(isEmpty("1.50", "cost")).toBe(false);
  });

  it("boolean: false/null/undefined are empty (attunement semantics)", () => {
    expect(isEmpty(false, "boolean")).toBe(true);
    expect(isEmpty(null, "boolean")).toBe(true);
    expect(isEmpty(undefined, "boolean")).toBe(true);
    expect(isEmpty(true, "boolean")).toBe(false);
  });
});
