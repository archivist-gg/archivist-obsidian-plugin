import { describe, it, expect } from "vitest";
import { toArmorCanonical } from "../../../tools/srd-canonical/merger-rules/armor-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("armorMergeRule", () => {
  it("produces canonical Armor for Plate (heavy, strength req, stealth disadvantage)", () => {
    const canonical: CanonicalEntry = {
      slug: "plate",
      edition: "2014",
      kind: "armor",
      base: {
        key: "plate",
        name: "Plate",
        document: { key: "srd-2014", name: "SRD 5.1" },
        category: "heavy",
        ac: { base: 18 },
        strength_required: 15,
        stealth_disadvantage: true,
        weight: 65,
        cost: "1500 gp",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toArmorCanonical(canonical);
    expect(out.slug).toBe("plate");
    expect(out.name).toBe("Plate");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.category).toBe("heavy");
    expect(out.ac.base).toBe(18);
    expect(out.ac.dex_max).toBeUndefined();
    expect(out.strength_required).toBe(15);
    expect(out.stealth_disadvantage).toBe(true);
    expect(out.weight).toBe(65);
    expect(out.cost).toBe("1500 gp");
  });

  it("produces canonical Armor for Studded Leather (light, dex_max in ac)", () => {
    const canonical: CanonicalEntry = {
      slug: "studded-leather",
      edition: "2014",
      kind: "armor",
      base: {
        key: "studded-leather",
        name: "Studded Leather",
        document: { key: "srd-2014", name: "SRD 5.1" },
        category: "light",
        ac: { base: 12, dex_max: undefined },
        stealth_disadvantage: false,
        weight: 13,
        cost: "45 gp",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toArmorCanonical(canonical);
    expect(out.category).toBe("light");
    expect(out.ac.base).toBe(12);
    expect(out.stealth_disadvantage).toBe(false);
    expect(out.strength_required).toBeUndefined();
  });

  it("produces canonical Armor for Shield (shield category, no stealth disadvantage)", () => {
    const canonical: CanonicalEntry = {
      slug: "shield",
      edition: "2014",
      kind: "armor",
      base: {
        key: "shield",
        name: "Shield",
        document: { key: "srd-2014", name: "SRD 5.1" },
        category: "shield",
        ac: { base: 2 },
        stealth_disadvantage: false,
        weight: 6,
        cost: "10 gp",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toArmorCanonical(canonical);
    expect(out.category).toBe("shield");
    expect(out.ac.base).toBe(2);
    expect(out.stealth_disadvantage).toBe(false);
  });
});
