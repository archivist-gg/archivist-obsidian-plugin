import { describe, it, expect } from "vitest";
import { toArmorCanonical } from "../../../tools/srd-canonical/merger-rules/armor-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseEntry = (base: Record<string, unknown>): CanonicalEntry => ({
  slug: "srd-5e_breastplate",
  edition: "2014",
  kind: "armor",
  base: base as CanonicalEntry["base"],
  structured: null,
  activation: null,
  overlay: null,
});

describe("armorMergeRule", () => {
  it("produces canonical Armor for Plate (heavy, strength req, stealth disadvantage)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_plate",
      edition: "2014",
      kind: "armor",
      base: {
        key: "srd_plate",
        name: "Plate",
        document: { key: "srd-2014", name: "SRD 5.1" },
        category: "heavy",
        ac_base: 18,
        ac_add_dexmod: false,
        ac_cap_dexmod: null,
        grants_stealth_disadvantage: true,
        strength_score_required: 15,
      } as CanonicalEntry["base"],
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toArmorCanonical(canonical);
    expect(out.slug).toBe("srd-5e_plate");
    expect(out.name).toBe("Plate");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.category).toBe("heavy");
    expect(out.ac.base).toBe(18);
    expect(out.ac.add_dex).toBe(false);
    expect(out.ac.dex_max).toBeUndefined();
    expect(out.strength_required).toBe(15);
    expect(out.stealth_disadvantage).toBe(true);
  });

  it("produces canonical Armor for Studded Leather (light, no dex cap)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_studded-leather",
      edition: "2014",
      kind: "armor",
      base: {
        key: "srd_studded-leather",
        name: "Studded Leather",
        document: { key: "srd-2014", name: "SRD 5.1" },
        category: "light",
        ac_base: 12,
        ac_add_dexmod: true,
        ac_cap_dexmod: null,
        grants_stealth_disadvantage: false,
        strength_score_required: null,
      } as CanonicalEntry["base"],
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toArmorCanonical(canonical);
    expect(out.category).toBe("light");
    expect(out.ac.base).toBe(12);
    expect(out.ac.add_dex).toBe(true);
    expect(out.ac.dex_max).toBeUndefined();
    expect(out.stealth_disadvantage).toBe(false);
    expect(out.strength_required).toBeUndefined();
  });

  it("produces canonical Armor for Shield (shield category, no stealth disadvantage)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_shield",
      edition: "2014",
      kind: "armor",
      base: {
        key: "srd_shield",
        name: "Shield",
        document: { key: "srd-2014", name: "SRD 5.1" },
        category: "shield",
        ac_base: 2,
        ac_add_dexmod: false,
        ac_cap_dexmod: null,
        grants_stealth_disadvantage: false,
        strength_score_required: null,
      } as CanonicalEntry["base"],
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

describe("armor-merge field-path correctness", () => {
  it("reads ac_cap_dexmod for ac.dex_max (not the boolean ac_add_dexmod)", () => {
    const result = toArmorCanonical(baseEntry({
      name: "Breastplate",
      category: "medium",
      ac_base: 14,
      ac_add_dexmod: true,
      ac_cap_dexmod: 2,
      grants_stealth_disadvantage: false,
      strength_score_required: null,
    }));
    expect(result.ac.dex_max).toBe(2);
  });

  it("reads grants_stealth_disadvantage (not stealth_disadvantage)", () => {
    const result = toArmorCanonical(baseEntry({
      name: "Plate",
      category: "heavy",
      ac_base: 18,
      ac_add_dexmod: false,
      ac_cap_dexmod: null,
      grants_stealth_disadvantage: true,
      strength_score_required: 15,
    }));
    expect(result.stealth_disadvantage).toBe(true);
  });

  it("reads strength_score_required (not strength_required)", () => {
    const result = toArmorCanonical(baseEntry({
      name: "Plate",
      category: "heavy",
      ac_base: 18,
      ac_add_dexmod: false,
      ac_cap_dexmod: null,
      grants_stealth_disadvantage: true,
      strength_score_required: 15,
    }));
    expect(result.strength_required).toBe(15);
  });
});
