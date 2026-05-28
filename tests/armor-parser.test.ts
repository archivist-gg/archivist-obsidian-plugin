import { describe, it, expect } from "vitest";
import { parseArmor } from "../src/modules/armor/armor.parser";
import { PLATE, BREASTPLATE, SHIELD, MAGE_ARMOR } from "./fixtures/armor";

describe("parseArmor", () => {
  it("parses a heavy armor fixture", () => {
    const r = parseArmor(PLATE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Plate");
      expect(r.data.ac.base).toBe(18);
    }
  });

  it("parses medium armor with capped DEX", () => {
    const r = parseArmor(BREASTPLATE);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ac.dex_max).toBe(2);
  });

  it("parses a shield with flat AC bonus", () => {
    const r = parseArmor(SHIELD);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ac.flat).toBe(2);
  });

  it("parses Mage Armor (category: spell)", () => {
    const r = parseArmor(MAGE_ARMOR);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.category).toBe("spell");
  });

  it("preserves unknown fields under raw", () => {
    const src = `name: Plate\nslug: plate\ncategory: heavy\nac: { base: 18, flat: 0, add_dex: false, add_con: false, add_wis: false }\ndocument__url: http://example.com`;
    const r = parseArmor(src);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.raw?.document__url).toBe("http://example.com");
  });

  it("rejects malformed YAML", () => {
    const r = parseArmor(":\n  - bad");
    expect(r.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const r = parseArmor(`name: Plate`);
    expect(r.success).toBe(false);
  });
});
