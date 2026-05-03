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

import { classifyGap } from "../../tools/srd-canonical/audit-merger-gaps";

describe("classifyGap", () => {
  it("both empty → both-empty", () => {
    expect(classifyGap(null, undefined, "string")).toBe("both-empty");
  });

  it("only Open5e → open5e-only", () => {
    expect(classifyGap("longsword", null, "string")).toBe("open5e-only");
  });

  it("only 5etools → 5etools-only", () => {
    expect(classifyGap(null, "longsword", "string")).toBe("5etools-only");
  });

  it("both populated, equal values → match", () => {
    expect(classifyGap("rare", "rare", "string")).toBe("match");
  });

  it("both populated, unequal values → disagree", () => {
    expect(classifyGap("rare", "very rare", "string")).toBe("disagree");
  });

  it("both populated numbers, unequal → disagree", () => {
    expect(classifyGap(3, 5, "number")).toBe("disagree");
  });

  it("cost: '0.00' on Open5e + '1.00' on 5etools → 5etools-only", () => {
    expect(classifyGap("0.00", "1.00", "cost")).toBe("5etools-only");
  });

  it("boolean: false on Open5e + true on 5etools → 5etools-only", () => {
    expect(classifyGap(false, true, "boolean")).toBe("5etools-only");
  });
});
