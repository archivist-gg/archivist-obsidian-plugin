import { describe, it, expect } from "vitest";
import { toWeaponCanonical } from "../../../tools/srd-canonical/merger-rules/weapon-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

// Open5e v2 weapon raw shape (subset that the merger reads).
const longsword2014 = {
  key: "srd_longsword",
  name: "Longsword",
  damage_dice: "1d8",
  damage_type: { name: "Slashing", key: "slashing" },
  range: 0,
  long_range: 0,
  is_simple: false,
  is_improvised: false,
  properties: [
    {
      property: { name: "Versatile", type: null, desc: "..." },
      detail: "1d10",
    },
  ],
};

const club2014 = {
  key: "srd_club",
  name: "Club",
  damage_dice: "1d4",
  damage_type: { name: "Bludgeoning", key: "bludgeoning" },
  range: 0,
  long_range: 0,
  is_simple: true,
  is_improvised: false,
  properties: [
    { property: { name: "Light", type: null, desc: "..." }, detail: null },
  ],
};

const longbow2014 = {
  key: "srd_longbow",
  name: "Longbow",
  damage_dice: "1d8",
  damage_type: { name: "Piercing", key: "piercing" },
  range: 150,
  long_range: 600,
  is_simple: false,
  is_improvised: false,
  properties: [
    {
      property: { name: "Ammunition", type: null, desc: "..." },
      detail: "range 150/600",
    },
    {
      property: { name: "Two-Handed", type: null, desc: "..." },
      detail: null,
    },
  ],
};

const sling2014 = {
  key: "srd_sling",
  name: "Sling",
  damage_dice: "1d4",
  damage_type: { name: "Bludgeoning", key: "bludgeoning" },
  range: 30,
  long_range: 120,
  is_simple: true,
  is_improvised: false,
  properties: [
    {
      property: { name: "Ammunition", type: null, desc: "..." },
      detail: "range 30/120",
    },
  ],
};

const greataxe2024 = {
  key: "srd-2024_greataxe",
  name: "Greataxe",
  damage_dice: "1d12",
  damage_type: { name: "Slashing", key: "slashing" },
  range: 0,
  long_range: 0,
  is_simple: false,
  is_improvised: false,
  properties: [
    {
      property: { name: "Cleave", type: "Mastery", desc: "..." },
      detail: null,
    },
    { property: { name: "Heavy", type: null, desc: "..." }, detail: null },
    { property: { name: "Two-Handed", type: null, desc: "..." }, detail: null },
  ],
};

function entry(
  base: object,
  edition: "2014" | "2024" = "2014",
  slug = "test_slug",
): CanonicalEntry {
  return {
    slug,
    edition,
    kind: "weapon",
    base: base as never,
    structured: null,
    activation: null,
    overlay: null,
  };
}

describe("weaponMergeRule", () => {
  it("composes damage from damage_dice + damage_type.key with versatile_dice from properties", () => {
    const out = toWeaponCanonical(entry(longsword2014));
    expect(out.damage.dice).toBe("1d8");
    expect(out.damage.type).toBe("slashing");
    expect(out.damage.versatile_dice).toBe("1d10");
  });

  it("emits properties as kebab-case string array; excludes Mastery entries", () => {
    const out = toWeaponCanonical(entry(longsword2014));
    expect(out.properties).toEqual(["versatile"]);

    const greataxe = toWeaponCanonical(entry(greataxe2024, "2024"));
    expect(greataxe.properties).toEqual(["heavy", "two-handed"]);
    expect(greataxe.properties).not.toContain("cleave");
  });

  it("surfaces Mastery properties as a separate mastery field", () => {
    const out = toWeaponCanonical(entry(greataxe2024, "2024"));
    expect(out.mastery).toEqual(["cleave"]);
  });

  it("omits mastery on weapons with no Mastery-typed properties", () => {
    const out = toWeaponCanonical(entry(longsword2014));
    expect(out.mastery).toBeUndefined();
  });

  it("computes simple-melee category from is_simple=true + range=0", () => {
    const out = toWeaponCanonical(entry(club2014));
    expect(out.category).toBe("simple-melee");
  });

  it("computes simple-ranged category from is_simple=true + range>0", () => {
    const out = toWeaponCanonical(entry(sling2014));
    expect(out.category).toBe("simple-ranged");
  });

  it("computes martial-melee category from is_simple=false + range=0", () => {
    const out = toWeaponCanonical(entry(longsword2014));
    expect(out.category).toBe("martial-melee");
  });

  it("computes martial-ranged category from is_simple=false + range>0", () => {
    const out = toWeaponCanonical(entry(longbow2014));
    expect(out.category).toBe("martial-ranged");
  });

  it("computes improvised category when is_improvised=true", () => {
    const improvised = {
      ...club2014,
      key: "srd_improvised",
      name: "Improvised Weapon",
      is_simple: false,
      is_improvised: true,
    };
    const out = toWeaponCanonical(entry(improvised));
    expect(out.category).toBe("improvised");
  });

  it("emits range only when range>0 (skipped for melee weapons)", () => {
    const melee = toWeaponCanonical(entry(longsword2014));
    expect(melee.range).toBeUndefined();

    const ranged = toWeaponCanonical(entry(longbow2014));
    expect(ranged.range).toEqual({ normal: 150, long: 600 });
  });

  it("sets edition + source from CanonicalEntry edition", () => {
    const out2014 = toWeaponCanonical(entry(longsword2014, "2014"));
    expect(out2014.edition).toBe("2014");
    expect(out2014.source).toBe("SRD 5.1");

    const out2024 = toWeaponCanonical(entry(greataxe2024, "2024"));
    expect(out2024.edition).toBe("2024");
    expect(out2024.source).toBe("SRD 5.2");
  });

  it("preserves slug + name", () => {
    const out = toWeaponCanonical(entry(longsword2014, "2014", "srd-5e_longsword"));
    expect(out.slug).toBe("srd-5e_longsword");
    expect(out.name).toBe("Longsword");
  });
});
