import { describe, it, expect } from "vitest";
import { getSpellcastingProfile } from "../src/modules/pc/pc.spellcasting";

describe("getSpellcastingProfile", () => {
  it("returns the wizard profile (INT, full, prepared) for both editions", () => {
    for (const ed of ["2014", "2024"] as const) {
      const p = getSpellcastingProfile("wizard", ed);
      expect(p).toEqual({ ability: "int", casterType: "full", preparation: "prepared" });
    }
  });

  it("classifies paladin as a half caster, prepared, CHA", () => {
    expect(getSpellcastingProfile("paladin", "2014")).toEqual({
      ability: "cha", casterType: "half", preparation: "prepared",
    });
  });

  it("classifies warlock as pact, known, CHA", () => {
    expect(getSpellcastingProfile("warlock", "2024")).toEqual({
      ability: "cha", casterType: "pact", preparation: "known",
    });
  });

  it("ranger is half/known in 2014 but half/prepared in 2024", () => {
    expect(getSpellcastingProfile("ranger", "2014")?.preparation).toBe("known");
    expect(getSpellcastingProfile("ranger", "2024")?.preparation).toBe("prepared");
  });

  it("returns null for non-casters", () => {
    expect(getSpellcastingProfile("barbarian", "2014")).toBeNull();
    expect(getSpellcastingProfile("fighter", "2024")).toBeNull();
  });

  it("strips [[ ]] brackets and is case-insensitive on the class slug", () => {
    expect(getSpellcastingProfile("[[Wizard]]", "2014")?.ability).toBe("int");
  });

  it("recognizes compendium-prefixed class slugs (real vault data uses srd-5e_/srd-2024_)", () => {
    expect(getSpellcastingProfile("[[srd-5e_wizard]]", "2014")).toEqual({ ability: "int", casterType: "full", preparation: "prepared" });
    expect(getSpellcastingProfile("srd-2024_bard", "2024")).toEqual({ ability: "cha", casterType: "full", preparation: "prepared" });
    expect(getSpellcastingProfile("[[srd-5e_warlock]]", "2014")?.casterType).toBe("pact");
    expect(getSpellcastingProfile("[[srd-5e_fighter]]", "2014")).toBeNull();
  });
});
