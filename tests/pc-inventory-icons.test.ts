// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as obsidian from "obsidian";
import { setInventoryIcon, INVENTORY_ICON_KEYS } from "../src/modules/pc/assets/inventory-icons";

const setIconSpy = vi.spyOn(obsidian, "setIcon");

describe("setInventoryIcon", () => {
  beforeEach(() => {
    setIconSpy.mockClear();
  });

  it("mounts an SVG element when called with an inventory-icon key", () => {
    const el = document.createElement("div");
    setInventoryIcon(el, "ring");

    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 512 512");
    expect(setIconSpy).not.toHaveBeenCalled();
  });

  it("clears prior children before mounting (inventory-icon path)", () => {
    const el = document.createElement("div");
    el.appendChild(document.createElement("span"));
    el.appendChild(document.createTextNode("stale"));
    expect(el.childNodes.length).toBe(2);

    setInventoryIcon(el, "axe");

    expect(el.childNodes.length).toBe(1);
    expect((el.firstChild as Element).tagName.toLowerCase()).toBe("svg");
  });

  it("forwards Lucide names through to obsidian.setIcon", () => {
    const el = document.createElement("div");
    setInventoryIcon(el, "sword");

    expect(setIconSpy).toHaveBeenCalledTimes(1);
    expect(setIconSpy).toHaveBeenCalledWith(el, "sword");
  });

  it("clears prior children before delegating to setIcon (Lucide path)", () => {
    const el = document.createElement("div");
    el.appendChild(document.createElement("svg"));
    expect(el.childNodes.length).toBe(1);

    setInventoryIcon(el, "package");

    // The mocked setIcon is a no-op, so post-clearing the element is empty.
    expect(el.childNodes.length).toBe(0);
    expect(setIconSpy).toHaveBeenCalledWith(el, "package");
  });

  it("re-rendering with a different inventory key replaces the prior svg", () => {
    const el = document.createElement("div");
    setInventoryIcon(el, "ring");
    const first = el.firstChild;
    setInventoryIcon(el, "wand");
    expect(el.firstChild).not.toBe(first);
    expect(el.childNodes.length).toBe(1);
  });

  it("the registry includes all weapon, armor, and item keys covered by icon-mapping", () => {
    const required = [
      "axe",
      "bow",
      "crossbow",
      "dagger",
      "hammer",
      "mace",
      "spear",
      "whip",
      "bow-thrown",
      "leather",
      "chain-mail",
      "breastplate",
      "ring",
      "amulet",
      "cloak",
      "wand",
      "staff",
      "rod",
    ];
    for (const key of required) {
      expect(INVENTORY_ICON_KEYS).toContain(key);
    }
  });
});
