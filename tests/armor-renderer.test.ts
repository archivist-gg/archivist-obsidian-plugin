/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { renderArmorBlock } from "../src/modules/armor/armor.renderer";
import { parseArmor } from "../src/modules/armor/armor.parser";
import { PLATE, BREASTPLATE, SHIELD, MAGE_ARMOR } from "./fixtures/armor";

beforeEach(() => {
  document.body.replaceChildren();
});

function renderFromYaml(src: string): HTMLElement {
  const parsed = parseArmor(src);
  if (!parsed.success) throw new Error(parsed.error);
  return renderArmorBlock(parsed.data);
}

describe("renderArmorBlock", () => {
  it("renders Plate with name, AC formula, strength req, and stealth disadvantage", () => {
    const el = renderFromYaml(PLATE);
    expect(el.textContent).toContain("Plate");
    expect(el.textContent).toContain("18");
    expect(el.textContent).toContain("Str 15");
    expect(el.textContent).toContain("Disadvantage");
  });

  it("renders Breastplate AC formula with capped Dex", () => {
    const el = renderFromYaml(BREASTPLATE);
    expect(el.textContent).toContain("14 + Dex modifier (max 2)");
  });

  it("renders Shield as +2", () => {
    const el = renderFromYaml(SHIELD);
    expect(el.textContent).toContain("Shield");
    // Shield uses description "+2"; renderer falls back to that.
    expect(el.textContent).toContain("+2");
  });

  it("renders Mage Armor (no weight/cost) without Cost row", () => {
    const el = renderFromYaml(MAGE_ARMOR);
    expect(el.textContent).toContain("Mage Armor");
    expect(el.textContent).not.toContain("Cost");
  });
});
