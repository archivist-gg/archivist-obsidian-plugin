// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

describe("global ResizeObserver stub (tests/setup.ts)", () => {
  it("provides a constructible no-op ResizeObserver in the jsdom environment", () => {
    expect(typeof ResizeObserver).toBe("function");
    const ro = new ResizeObserver(() => {});
    expect(() => ro.observe(document.createElement("div"))).not.toThrow();
    expect(() => ro.unobserve(document.createElement("div"))).not.toThrow();
    expect(() => ro.disconnect()).not.toThrow();
  });
});
