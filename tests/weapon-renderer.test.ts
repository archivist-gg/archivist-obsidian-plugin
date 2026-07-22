/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { renderWeaponBlock } from "../packages/obsidian/src/modules/weapon/weapon.renderer";
import { parseWeapon } from "@archivist-gg/dnd5e/weapon/weapon.parser";
import { LONGSWORD, DAGGER, LONGBOW, NET, LANCE } from "./fixtures/weapon";

beforeEach(() => {
  document.body.replaceChildren();
});

function renderFromYaml(src: string): HTMLElement {
  const r = parseWeapon(src);
  if (!r.success) throw new Error(r.error);
  return renderWeaponBlock(r.data);
}

describe("renderWeaponBlock", () => {
  it("renders Longsword: damage with versatile, properties", () => {
    const el = renderFromYaml(LONGSWORD);
    expect(el.textContent).toContain("Longsword");
    expect(el.textContent).toContain("1d8 (1d10) slashing");
    expect(el.textContent).toContain("Versatile");
  });

  it("renders Dagger: thrown-melee range line and corrected category", () => {
    const el = renderFromYaml(DAGGER);
    expect(el.textContent).toContain("5 ft · thrown 20/60 ft");
    expect(el.textContent).toContain("Simple Melee"); // corrected category (fixture is simple-ranged)
    expect(el.textContent).toContain("Finesse");
    expect(el.textContent).toContain("Thrown");
  });

  it("renders melee-only weapon (no range struct) with a 5 ft range line", () => {
    const el = renderFromYaml(LONGSWORD);
    expect(el.textContent).toContain("5 ft");
  });

  it("renders pure-ranged weapon: N/M ft line, no thrown, unchanged category", () => {
    const el = renderFromYaml(LONGBOW);
    expect(el.textContent).toContain("150/600 ft");
    expect(el.textContent).not.toContain("thrown");
    expect(el.textContent).toContain("Martial Ranged");
  });

  it("renders Net with em-dash for damage-less weapon", () => {
    const el = renderFromYaml(NET);
    expect(el.textContent).toContain("—");
  });

  it("renders Lance conditional property with tooltip note", () => {
    const el = renderFromYaml(LANCE);
    const conditional = el.querySelector(".archivist-weapon-conditional-property");
    expect(conditional).not.toBeNull();
    expect(conditional?.getAttribute("title")).toBe("unless mounted");
  });
});
