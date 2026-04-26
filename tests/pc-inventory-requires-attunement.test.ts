import { describe, it, expect } from "vitest";
import { requiresAttunement } from "../src/modules/pc/components/inventory/requires-attunement";

describe("requiresAttunement", () => {
  it("returns false for null entity (inline items)", () => {
    expect(requiresAttunement(null)).toBe(false);
  });
  it("returns false when attunement is undefined", () => {
    expect(requiresAttunement({ name: "Plate" })).toBe(false);
  });
  it("returns true when attunement is the literal true", () => {
    expect(requiresAttunement({ name: "Ring", attunement: true })).toBe(true);
  });
  it("returns true when attunement is a non-empty string (restriction text)", () => {
    expect(requiresAttunement({ name: "Ring", attunement: "by a wizard" })).toBe(true);
  });
  it("returns true when attunement is { required: true }", () => {
    expect(requiresAttunement({ name: "Ring", attunement: { required: true } })).toBe(true);
  });
  it("returns false when attunement is { required: false }", () => {
    expect(requiresAttunement({ name: "Ring", attunement: { required: false } })).toBe(false);
  });
  it("returns false when attunement is the literal false", () => {
    expect(requiresAttunement({ name: "Ring", attunement: false })).toBe(false);
  });
  it("returns false when attunement is the empty string", () => {
    expect(requiresAttunement({ name: "Ring", attunement: "" })).toBe(false);
  });
});
