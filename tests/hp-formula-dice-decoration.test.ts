/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("obsidian", () => ({
  setIcon: vi.fn(),
  Notice: vi.fn(),
}));

// Monkey-patch HTMLElement.prototype with the Obsidian DOM extension methods
// that the renderer code relies on, so `el()` works in jsdom.
beforeAll(() => {
  const proto = HTMLElement.prototype as any;

  proto.addClass = function (cls: string) {
    cls.split(/\s+/).filter(Boolean).forEach((c: string) => this.classList.add(c));
    return this;
  };

  proto.addClasses = function (classes: string[]) {
    classes.forEach((cls) => {
      cls.split(/\s+/).filter(Boolean).forEach((c: string) => this.classList.add(c));
    });
    return this;
  };

  proto.removeClass = function (cls: string) {
    cls.split(/\s+/).filter(Boolean).forEach((c: string) => this.classList.remove(c));
    return this;
  };

  proto.hasClass = function (cls: string) {
    return this.classList.contains(cls);
  };

  proto.empty = function () {
    while (this.firstChild) this.removeChild(this.firstChild);
  };

  proto.appendText = function (text: string) {
    this.appendChild(document.createTextNode(text));
  };
});

import { renderMonsterBlock } from "../src/modules/monster/monster.renderer";
import type { Monster } from "../src/modules/monster/monster.types";

const BASE_MONSTER: Monster = {
  name: "Test Dragon",
  size: "Huge",
  type: "Dragon",
  abilities: { str: 20, dex: 10, con: 20, int: 10, wis: 10, cha: 10 },
  hp: { average: 256, formula: "19d12+133" },
  cr: "17",
} as Monster;

describe("HP formula dice decoration", () => {
  it("wraps the HP formula in a dice pill", () => {
    const node = renderMonsterBlock(BASE_MONSTER);
    const dicePill = node.querySelector(".archivist-stat-tag-dice");
    expect(dicePill).not.toBeNull();
    expect(dicePill?.textContent).toContain("19d12+133");
  });

  it("still shows the HP average before the pill", () => {
    const node = renderMonsterBlock(BASE_MONSTER);
    const hpLine = node.querySelectorAll(".property-line")[1]?.querySelector("p");
    expect(hpLine?.textContent).toContain("256");
    expect(hpLine?.textContent).toContain("(");
    expect(hpLine?.textContent).toContain(")");
  });
});
