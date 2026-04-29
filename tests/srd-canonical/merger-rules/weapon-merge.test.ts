import { describe, it, expect } from "vitest";
import { toWeaponCanonical } from "../../../tools/srd-canonical/merger-rules/weapon-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseLongsword2014 = {
  key: "longsword",
  name: "Longsword",
  document: { key: "srd-2014", name: "SRD 5.1" },
  category: "martial-melee",
  damage: { dice: "1d8", type: "slashing", versatile_dice: "1d10" },
  properties: ["versatile"],
  cost: "15 gp",
  weight: 3,
};

describe("weaponMergeRule", () => {
  it("produces canonical Weapon from Open5e-only entry (Longsword 2014, no mastery)", () => {
    const canonical: CanonicalEntry = {
      slug: "longsword",
      edition: "2014",
      kind: "weapon",
      base: baseLongsword2014,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toWeaponCanonical(canonical);
    expect(out.slug).toBe("longsword");
    expect(out.name).toBe("Longsword");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.category).toBe("martial-melee");
    expect(out.damage.dice).toBe("1d8");
    expect(out.damage.type).toBe("slashing");
    expect(out.properties).toEqual(["versatile"]);
    expect(out.cost).toBe("15 gp");
    expect(out.weight).toBe(3);
    expect(out.mastery).toBeUndefined();
  });

  it("populates mastery from structured-rules (Longsword 2024)", () => {
    const canonical: CanonicalEntry = {
      slug: "longsword",
      edition: "2024",
      kind: "weapon",
      base: { ...baseLongsword2014, document: { key: "srd-2024", name: "SRD 5.2" } },
      structured: {
        name: "Longsword",
        source: "XPHB",
        mastery: ["sap"],
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toWeaponCanonical(canonical);
    expect(out.edition).toBe("2024");
    expect(out.source).toBe("SRD 5.2");
    expect(out.mastery).toEqual(["sap"]);
  });

  it("preserves versatile_dice from Open5e damage", () => {
    const canonical: CanonicalEntry = {
      slug: "longsword",
      edition: "2014",
      kind: "weapon",
      base: baseLongsword2014,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toWeaponCanonical(canonical);
    expect(out.damage.versatile_dice).toBe("1d10");
    expect(out.properties).toContain("versatile");
  });
});
