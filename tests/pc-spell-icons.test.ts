/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { setDamageTypeIcon, hasDamageTypeIcon } from "../packages/obsidian/src/modules/pc/assets/spell-icons";

describe("setDamageTypeIcon", () => {
  it("mounts an <svg> for a known damage type", () => {
    const el = document.createElement("span");
    setDamageTypeIcon(el, "fire");
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
  it("is case-insensitive", () => {
    const el = document.createElement("span");
    setDamageTypeIcon(el, "FIRE");
    expect(el.querySelector("svg")).not.toBeNull();
  });
  it("no-ops cleanly for an unknown type (no svg, no throw)", () => {
    const el = document.createElement("span");
    setDamageTypeIcon(el, "wibble");
    expect(el.querySelector("svg")).toBeNull();
  });
  it("hasDamageTypeIcon reports coverage", () => {
    expect(hasDamageTypeIcon("force")).toBe(true);
    expect(hasDamageTypeIcon("wibble")).toBe(false);
  });
});
