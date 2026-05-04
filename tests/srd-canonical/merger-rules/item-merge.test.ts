import { describe, it, expect } from "vitest";
import { toItemCanonical, enrichItemsWithVariantBonuses } from "../../../tools/srd-canonical/merger-rules/item-merge";
import { baseItemFromStructured, cpToGpString, entriesToProse } from "../../../tools/srd-canonical/merger-rules/item-merge";
import { mapDmgTypeCode } from "../../../tools/srd-canonical/merger-rules/item-merge";
import { mapPropertyTags } from "../../../tools/srd-canonical/merger-rules/item-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

function makeEntry(overrides: { base?: Record<string, unknown>; structured?: Record<string, unknown> }): CanonicalEntry {
  return {
    slug: typeof overrides.base?.name === "string"
      ? (overrides.base.name as string).toLowerCase().replace(/\s+/g, "-")
      : "test",
    edition: "2014",
    base: { name: "Test", rarity: "rare", ...overrides.base } as never,
    structured: (overrides.structured ?? null) as never,
    activation: null,
    overlay: null,
  } as CanonicalEntry;
}

describe("itemMergeRule", () => {
  it("produces canonical Item for Cloak of Protection (simple bonuses)", () => {
    const canonical: CanonicalEntry = {
      slug: "cloak-of-protection",
      edition: "2014",
      kind: "item",
      base: {
        key: "cloak-of-protection",
        name: "Cloak of Protection",
        document: { key: "srd-2014", name: "SRD 5.1" },
        rarity: "uncommon",
        requires_attunement: true,
        desc: "You gain a +1 bonus to AC and saving throws while you wear this cloak.",
      },
      structured: {
        name: "Cloak of Protection",
        source: "DMG",
        bonusAc: 1,
        bonusSavingThrow: 1,
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toItemCanonical(canonical);
    expect(out.slug).toBe("cloak-of-protection");
    expect(out.name).toBe("Cloak of Protection");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.rarity).toBe("uncommon");
    expect(out.attunement?.required).toBe(true);
    expect(out.description).toContain("+1 bonus to AC");
    expect(out.bonuses?.ac).toBe(1);
    expect(out.bonuses?.saving_throws).toBe(1);
    expect(out.bonuses?.weapon_attack).toBeUndefined();
    expect(out.charges).toBeUndefined();
  });

  it("produces canonical Item for Bracers of Defense (basic shape, no overlay)", () => {
    const canonical: CanonicalEntry = {
      slug: "bracers-of-defense",
      edition: "2014",
      kind: "item",
      base: {
        key: "bracers-of-defense",
        name: "Bracers of Defense",
        document: { key: "srd-2014", name: "SRD 5.1" },
        rarity: "rare",
        requires_attunement: true,
        desc: "While wearing these bracers, you gain a +2 bonus to AC if you are wearing no armor and using no shield.",
      },
      structured: {
        name: "Bracers of Defense",
        source: "DMG",
        bonusAc: 2,
        reqAttuneTags: [{ class: "monk" }],
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toItemCanonical(canonical);
    expect(out.bonuses?.ac).toBe(2);
    expect(out.attunement?.tags).toEqual([{ class: "monk" }]);
    // Conditional bonus (no_armor / no_shield) is a follow-up; for now plain pass-through.
  });

  it("produces canonical Item for Necklace of Fireballs (charges + attached_spells.charges)", () => {
    const canonical: CanonicalEntry = {
      slug: "necklace-of-fireballs",
      edition: "2014",
      kind: "item",
      base: {
        key: "necklace-of-fireballs",
        name: "Necklace of Fireballs",
        document: { key: "srd-2014", name: "SRD 5.1" },
        rarity: "rare",
        requires_attunement: false,
        desc: "This necklace has 1d6 + 3 beads… You can detach a bead to throw it as a fireball.",
      },
      structured: {
        name: "Necklace of Fireballs",
        source: "DMG",
        charges: 9,
        recharge: "dawn",
        rechargeAmount: "1d6+3",
        tier: 2,
        attachedSpells: {
          charges: { "1": ["fireball"] },
        },
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toItemCanonical(canonical);
    expect(out.charges).toEqual({ max: 9, recharge: "dawn", recharge_amount: "1d6+3" });
    expect(out.tier).toBe(2);
    expect(out.attached_spells?.charges).toEqual({ "1": ["fireball"] });
    expect(out.attunement).toBeUndefined();
  });

  it("bonusWeapon dual-emits weapon_attack AND weapon_damage", () => {
    const entry: CanonicalEntry = {
      slug: "srd-5e_sun-blade",
      edition: "2014",
      kind: "item",
      base: {
        key: "srd-5e_sun-blade",
        name: "Sun Blade",
        rarity: "rare",
        requires_attunement: true,
      },
      structured: {
        name: "Sun Blade",
        source: "DMG",
        bonusWeapon: "+2",
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toItemCanonical(entry);
    expect(out.bonuses?.weapon_attack).toBe(2);
    expect(out.bonuses?.weapon_damage).toBe(2);
  });

  it("bonusWeaponAttack does NOT dual-emit (attack-only)", () => {
    const entry: CanonicalEntry = {
      slug: "srd-5e_nikos-mace",
      edition: "2014",
      kind: "item",
      base: {
        key: "srd-5e_nikos-mace",
        name: "Niko's Mace",
        rarity: "rare",
      },
      structured: {
        name: "Niko's Mace",
        source: "DMG",
        bonusWeaponAttack: "+1",
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toItemCanonical(entry);
    expect(out.bonuses?.weapon_attack).toBe(1);
    expect(out.bonuses?.weapon_damage).toBeUndefined();
  });

  it("bonusWeaponDamage does NOT dual-emit (damage-only — Bracers of Archery)", () => {
    const entry: CanonicalEntry = {
      slug: "srd-5e_bracers-of-archery",
      edition: "2014",
      kind: "item",
      base: {
        key: "srd-5e_bracers-of-archery",
        name: "Bracers of Archery",
        rarity: "uncommon",
        requires_attunement: true,
      },
      structured: {
        name: "Bracers of Archery",
        source: "DMG",
        bonusWeaponDamage: "+2",
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toItemCanonical(entry);
    expect(out.bonuses?.weapon_damage).toBe(2);
    expect(out.bonuses?.weapon_attack).toBeUndefined();
  });

  describe("baseItemFromStructured", () => {
    it("parses 5etools slug into a SRD 5e wikilink for weapons (2014)", () => {
      expect(baseItemFromStructured("longsword|phb", "2014", "weapon"))
        .toBe("[[SRD 5e/Weapons/Longsword]]");
    });

    it("parses 5etools slug into a SRD 2024 wikilink for weapons (2024)", () => {
      expect(baseItemFromStructured("longsword|xphb", "2024", "weapon"))
        .toBe("[[SRD 2024/Weapons/Longsword]]");
    });

    it("title-cases multi-word kebab base names", () => {
      expect(baseItemFromStructured("hand-crossbow|phb", "2014", "weapon"))
        .toBe("[[SRD 5e/Weapons/Hand Crossbow]]");
    });

    it("uses the Armor subfolder for armor type", () => {
      expect(baseItemFromStructured("plate|phb", "2014", "armor"))
        .toBe("[[SRD 5e/Armor/Plate]]");
    });

    it("returns undefined for unknown type", () => {
      expect(baseItemFromStructured("longsword|phb", "2014", "wondrous")).toBeUndefined();
    });

    it("returns undefined for empty / malformed slugs", () => {
      expect(baseItemFromStructured("", "2014", "weapon")).toBeUndefined();
      expect(baseItemFromStructured(null as unknown as string, "2014", "weapon")).toBeUndefined();
      expect(baseItemFromStructured("|", "2014", "weapon")).toBeUndefined();
    });
  });

  describe("cpToGpString", () => {
    it("100 cp → '1.00'", () => {
      expect(cpToGpString(100)).toBe("1.00");
    });

    it("25 cp → '0.25'", () => {
      expect(cpToGpString(25)).toBe("0.25");
    });

    it("1 cp → '0.01'", () => {
      expect(cpToGpString(1)).toBe("0.01");
    });

    it("0 / null / undefined / negative → undefined", () => {
      expect(cpToGpString(0)).toBeUndefined();
      expect(cpToGpString(null as unknown as number)).toBeUndefined();
      expect(cpToGpString(undefined)).toBeUndefined();
      expect(cpToGpString(-1)).toBeUndefined();
    });
  });

  describe("entriesToProse", () => {
    it("plain string array → joined with double newlines", () => {
      expect(entriesToProse(["one", "two", "three"])).toBe("one\n\ntwo\n\nthree");
    });

    it("single string → string without separators", () => {
      expect(entriesToProse(["only"])).toBe("only");
    });

    it("empty array / null / undefined → undefined", () => {
      expect(entriesToProse([])).toBeUndefined();
      expect(entriesToProse(null as unknown as unknown[])).toBeUndefined();
      expect(entriesToProse(undefined)).toBeUndefined();
    });

    it("mixed array with non-string element → undefined", () => {
      expect(entriesToProse(["a", { type: "list", items: ["x"] }, "b"])).toBeUndefined();
    });
  });

  function structuredFallbackEntry(overrides: { base?: Record<string, unknown>; structured?: Record<string, unknown>; type?: string }): CanonicalEntry {
    return {
      slug: "srd-2024_test-item",
      edition: "2024",
      kind: "item",
      base: { key: "srd-2024_test-item", name: "Test Item", rarity: "rare", ...overrides.base },
      structured: (overrides.structured ?? null) as never,
      activation: null,
      overlay: null,
    } as CanonicalEntry;
  }

  describe("structured fallbacks (Open5e empty → 5etools used)", () => {
    it("base_item: falls back from structured.baseItem when base.weapon is null", () => {
      const entry = structuredFallbackEntry({
        base: { name: "Sun Blade", weapon: null, requires_attunement: true },
        structured: { name: "Sun Blade", source: "XDMG", baseItem: "longsword|xphb", bonusWeapon: "+2" },
      });
      const out = toItemCanonical(entry);
      expect(out.base_item).toBe("[[SRD 2024/Weapons/Longsword]]");
    });

    it("base_item: Open5e wins when both populated", () => {
      const entry = structuredFallbackEntry({
        base: { name: "Sun Blade", weapon: { name: "Greatsword" }, requires_attunement: true },
        structured: { name: "Sun Blade", source: "XDMG", baseItem: "longsword|xphb" },
      });
      const out = toItemCanonical(entry);
      expect(out.base_item).toBe("[[SRD 2024/Weapons/Greatsword]]");
    });

    it("attunement.required: false in Open5e + truthy reqAttune → required=true", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", requires_attunement: false },
        structured: { name: "X", source: "XDMG", reqAttune: true },
      });
      const out = toItemCanonical(entry);
      expect(out.attunement?.required).toBe(true);
    });

    it("attunement.restriction: Open5e missing detail + reqAttune string → restriction set", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", requires_attunement: true, attunement_detail: null },
        structured: { name: "X", source: "XDMG", reqAttune: "by a wizard" },
      });
      const out = toItemCanonical(entry);
      expect(out.attunement?.restriction).toBe("by a wizard");
    });

    it("cost: '0.00' in Open5e + structured.value → converted gp string", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", cost: "0.00" },
        structured: { name: "X", source: "XDMG", value: 100 },
      });
      const out = toItemCanonical(entry);
      expect(out.cost).toBe("1.00");
    });

    it("cost: Open5e wins when non-zero", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", cost: "5.00" },
        structured: { name: "X", source: "XDMG", value: 100 },
      });
      const out = toItemCanonical(entry);
      expect(out.cost).toBe("5.00");
    });

    it("rarity: missing in Open5e + present in structured → fallback applies", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", rarity: undefined },
        structured: { name: "X", source: "XDMG", rarity: "rare" },
      });
      const out = toItemCanonical(entry);
      expect(out.rarity).toBe("rare");
    });

    it("description: empty Open5e desc + structured.entries (string array) → joined prose", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", desc: "" },
        structured: { name: "X", source: "XDMG", entries: ["one", "two"] },
      });
      const out = toItemCanonical(entry);
      expect(out.description).toBe("one\n\ntwo");
    });

    it("description: empty Open5e + non-string entries → description stays empty", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", desc: "" },
        structured: { name: "X", source: "XDMG", entries: ["one", { type: "list", items: ["x"] }] },
      });
      const out = toItemCanonical(entry);
      expect(out.description).toBe("");
    });
  });

  describe("mapDmgTypeCode", () => {
    it("maps physical damage codes", () => {
      expect(mapDmgTypeCode("S")).toBe("slashing");
      expect(mapDmgTypeCode("P")).toBe("piercing");
      expect(mapDmgTypeCode("B")).toBe("bludgeoning");
    });

    it("maps magical damage codes", () => {
      expect(mapDmgTypeCode("R")).toBe("radiant");
      expect(mapDmgTypeCode("N")).toBe("necrotic");
      expect(mapDmgTypeCode("F")).toBe("fire");
      expect(mapDmgTypeCode("C")).toBe("cold");
      expect(mapDmgTypeCode("O")).toBe("force");
      expect(mapDmgTypeCode("Y")).toBe("psychic");
      expect(mapDmgTypeCode("T")).toBe("thunder");
      expect(mapDmgTypeCode("A")).toBe("acid");
      expect(mapDmgTypeCode("L")).toBe("lightning");
      expect(mapDmgTypeCode("I")).toBe("poison");
    });

    it("returns undefined for unknown codes", () => {
      expect(mapDmgTypeCode("Z")).toBeUndefined();
      expect(mapDmgTypeCode("")).toBeUndefined();
      expect(mapDmgTypeCode(undefined)).toBeUndefined();
      expect(mapDmgTypeCode(null as unknown as string)).toBeUndefined();
      expect(mapDmgTypeCode(123 as unknown as string)).toBeUndefined();
    });
  });

  describe("mapPropertyTags", () => {
    it("maps single-letter prefixes with edition suffix", () => {
      expect(mapPropertyTags(["F|XPHB", "V|XPHB"])).toEqual(["finesse", "versatile"]);
      expect(mapPropertyTags(["F|PHB"])).toEqual(["finesse"]);
    });

    it("maps multi-letter prefixes (2H, LD)", () => {
      expect(mapPropertyTags(["2H|XPHB", "H|XPHB"])).toEqual(["two-handed", "heavy"]);
      expect(mapPropertyTags(["LD|PHB"])).toEqual(["loading"]);
    });

    it("maps tags without an edition suffix", () => {
      expect(mapPropertyTags(["F", "V"])).toEqual(["finesse", "versatile"]);
    });

    it("drops unknown tags but keeps known ones in original order", () => {
      expect(mapPropertyTags(["F|XPHB", "ZZ|XPHB", "V|XPHB"])).toEqual(["finesse", "versatile"]);
    });

    it("returns empty array for empty input", () => {
      expect(mapPropertyTags([])).toEqual([]);
    });

    it("returns empty array for non-array / null / undefined", () => {
      expect(mapPropertyTags(undefined)).toEqual([]);
      expect(mapPropertyTags(null as unknown as string[])).toEqual([]);
      expect(mapPropertyTags("F|XPHB" as unknown as string[])).toEqual([]);
    });

    it("ignores non-string array elements", () => {
      expect(mapPropertyTags(["F|XPHB", 42 as unknown as string, "V|XPHB"])).toEqual(["finesse", "versatile"]);
    });

    it("maps the full standard weapon property set", () => {
      expect(mapPropertyTags([
        "A|XPHB", "F|XPHB", "H|XPHB", "L|XPHB", "LD|XPHB",
        "R|XPHB", "S|XPHB", "T|XPHB", "V|XPHB", "2H|XPHB",
      ])).toEqual([
        "ammunition", "finesse", "heavy", "light", "loading",
        "reach", "special", "thrown", "versatile", "two-handed",
      ]);
    });
  });

  describe("magic-weapon canonical fields (damage_type, properties)", () => {
    it("damage_type: structured.dmgType maps to canonical name when present", () => {
      const entry = structuredFallbackEntry({
        base: { name: "Sun Blade", weapon: null },
        structured: { name: "Sun Blade", source: "XDMG", baseItem: "longsword|xphb", dmgType: "R" },
      });
      const out = toItemCanonical(entry);
      expect(out.damage_type).toBe("radiant");
    });

    it("damage_type: omitted when structured.dmgType absent", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X", weapon: { name: "Mace" } },
        structured: { name: "X", source: "XDMG", baseItem: "mace|xphb" },
      });
      const out = toItemCanonical(entry);
      expect(out.damage_type).toBeUndefined();
    });

    it("damage_type: omitted when structured.dmgType is unknown code", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X" },
        structured: { name: "X", source: "XDMG", dmgType: "Z" },
      });
      const out = toItemCanonical(entry);
      expect(out.damage_type).toBeUndefined();
    });

    it("properties: structured.property maps to canonical names when present", () => {
      const entry = structuredFallbackEntry({
        base: { name: "Sun Blade", weapon: null },
        structured: { name: "Sun Blade", source: "XDMG", property: ["F|XPHB", "V|XPHB"] },
      });
      const out = toItemCanonical(entry);
      expect(out.properties).toEqual(["finesse", "versatile"]);
    });

    it("properties: omitted when structured.property absent", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X" },
        structured: { name: "X", source: "XDMG", baseItem: "longsword|xphb" },
      });
      const out = toItemCanonical(entry);
      expect(out.properties).toBeUndefined();
    });

    it("properties: omitted when structured.property is empty array", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X" },
        structured: { name: "X", source: "XDMG", property: [] },
      });
      const out = toItemCanonical(entry);
      expect(out.properties).toBeUndefined();
    });

    it("properties: omitted when no structured at all", () => {
      const entry = structuredFallbackEntry({
        base: { name: "X" },
        structured: undefined,
      });
      const out = toItemCanonical(entry);
      expect(out.damage_type).toBeUndefined();
      expect(out.properties).toBeUndefined();
    });
  });
});

describe("item-merge Open5e shape normalization", () => {
  const makeEntry = (overrides: Partial<CanonicalEntry> & { base: Record<string, unknown> }): CanonicalEntry => ({
    slug: overrides.slug ?? "srd-5e_bag-of-holding",
    edition: overrides.edition ?? "2014",
    kind: overrides.kind ?? "item",
    base: overrides.base as never,
    structured: overrides.structured ?? null,
    activation: overrides.activation ?? null,
    overlay: null,
  });

  it("normalizes rarity object to lowercase string", () => {
    const result = toItemCanonical(makeEntry({
      base: {
        name: "Bag of Holding",
        rarity: { name: "Uncommon", key: "uncommon", rank: 2 },
        category: { name: "Wondrous Item", key: "wondrous-item" },
        desc: "...",
        requires_attunement: false,
      },
    }));
    expect(result.rarity).toBe("uncommon");
  });

  it("maps category.key to runtime type ('wondrous-item' -> 'wondrous item')", () => {
    const result = toItemCanonical(makeEntry({
      base: {
        name: "Bag of Holding",
        rarity: { name: "Uncommon", key: "uncommon", rank: 2 },
        category: { name: "Wondrous Item", key: "wondrous-item" },
        desc: "...",
        requires_attunement: false,
      },
    }));
    expect(result.type).toBe("wondrous item");
  });

  it("emits base_item wikilink for magical weapons", () => {
    const result = toItemCanonical(makeEntry({
      slug: "srd-5e_battleaxe-1",
      base: {
        name: "Battleaxe (+1)",
        rarity: { name: "Uncommon", key: "uncommon", rank: 2 },
        category: { name: "Weapon", key: "weapon" },
        weapon: {
          name: "Battleaxe",
          key: "srd_battleaxe",
          damage_type: { name: "Slashing", key: "slashing" },
          damage_dice: "1d8",
          properties: [],
          is_simple: false,
          is_martial: true,
          is_improvised: false,
          distance_unit: "feet",
        },
        armor: null,
        desc: "...",
        requires_attunement: false,
      },
    }));
    expect(result.base_item).toBe("[[SRD 5e/Weapons/Battleaxe]]");
  });

  it("reads attunement_detail to attunement.restriction", () => {
    const result = toItemCanonical(makeEntry({
      slug: "srd-5e_holy-avenger",
      base: {
        name: "Holy Avenger",
        rarity: { name: "Legendary", key: "legendary", rank: 5 },
        category: { name: "Weapon", key: "weapon" },
        desc: "...",
        requires_attunement: true,
        attunement_detail: "by a paladin",
      },
    }));
    expect(result.attunement).toBeDefined();
    expect(result.attunement?.required).toBe(true);
    expect(result.attunement?.restriction).toBe("by a paladin");
  });

  it("surfaces structured-rules bonusWeapon to bonuses.weapon_attack", () => {
    const result = toItemCanonical(makeEntry({
      slug: "srd-5e_battleaxe-1",
      base: {
        name: "Battleaxe (+1)",
        rarity: { name: "Uncommon", key: "uncommon", rank: 2 },
        category: { name: "Weapon", key: "weapon" },
        desc: "...",
        requires_attunement: false,
      },
      structured: { name: "Battleaxe (+1)", bonusWeapon: "+1" } as never,
    }));
    // Coerced from "+1" string at the merger boundary so the runtime
    // accessor (readNumericBonus) sees a number.
    expect(result.bonuses?.weapon_attack).toBe(1);
  });
});

describe("STRUCTURED_BONUS_KEYS rename to runtime keys", () => {
  it("emits weapon_attack (not attack) from bonusWeapon", () => {
    const entry = makeEntry({ structured: { bonusWeapon: "+3" } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.weapon_attack).toBe(3);
    expect((out.bonuses as Record<string, unknown>).attack).toBeUndefined();
  });

  it("emits weapon_damage from bonusWeaponDamage", () => {
    const entry = makeEntry({ structured: { bonusWeaponDamage: "+2" } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.weapon_damage).toBe(2);
  });

  it("emits saving_throws (plural) from bonusSavingThrow", () => {
    const entry = makeEntry({ structured: { bonusSavingThrow: "+1" } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.saving_throws).toBe(1);
    expect((out.bonuses as Record<string, unknown>).saving_throw).toBeUndefined();
  });

  it("does NOT emit ability_check (no consumer)", () => {
    const entry = makeEntry({ structured: { bonusAbilityCheck: "+2" } });
    const out = toItemCanonical(entry);
    expect((out.bonuses as Record<string, unknown> | undefined)?.ability_check).toBeUndefined();
  });

  it("Defender Longsword shape: weapon_attack: 3, weapon_damage: 3, ac: 1", () => {
    const entry = makeEntry({
      base: { name: "Defender Longsword", rarity: "legendary" },
      structured: { bonusWeapon: "+3", bonusWeaponDamage: "+3", bonusAc: "+1" },
    });
    const out = toItemCanonical(entry);
    expect(out.bonuses).toMatchObject({ weapon_attack: 3, weapon_damage: 3, ac: 1 });
  });
});

describe("structured-bonus coercion (CB-1 / LI-1)", () => {
  it("coerces +N string to a positive number", () => {
    const entry = makeEntry({ structured: { bonusAc: "+1", bonusSavingThrow: "+1" } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.ac).toBe(1);
    expect(out.bonuses?.saving_throws).toBe(1);
  });

  it("coerces -N string to a negative number", () => {
    const entry = makeEntry({ structured: { bonusAc: "-2" } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.ac).toBe(-2);
  });

  it("passes through numeric bonuses unchanged", () => {
    const entry = makeEntry({ structured: { bonusAc: 3, bonusWeapon: 2 } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.ac).toBe(3);
    expect(out.bonuses?.weapon_attack).toBe(2);
  });

  it("skips invalid string values (non-numeric)", () => {
    const entry = makeEntry({ structured: { bonusAc: "invalid", bonusWeapon: "+abc" } });
    const out = toItemCanonical(entry);
    expect(out.bonuses).toBeUndefined();
  });

  it("trims whitespace around signed-int strings", () => {
    const entry = makeEntry({ structured: { bonusAc: "  +1  " } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.ac).toBe(1);
  });
});

describe("ability_scores extraction (I15)", () => {
  it("extracts ability.static into bonuses.ability_scores.static", () => {
    const entry = makeEntry({
      base: { name: "Amulet of Health" },
      structured: { ability: { static: { con: 19 } } },
    });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.ability_scores?.static).toEqual({ con: 19 });
  });

  it("extracts ability.bonus into bonuses.ability_scores.bonus", () => {
    const entry = makeEntry({ structured: { ability: { bonus: { str: 2 } } } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.ability_scores?.bonus).toEqual({ str: 2 });
  });
});

describe("speed extraction (I16)", () => {
  it("extracts modifySpeed.static.walk into bonuses.speed.walk", () => {
    const entry = makeEntry({ structured: { modifySpeed: { static: { walk: 30 } } } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.speed?.walk).toBe(30);
  });

  it("extracts modifySpeed.bonus.fly as numeric bonus", () => {
    const entry = makeEntry({ structured: { modifySpeed: { bonus: { fly: 10 } } } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.speed?.fly).toBe(10);
  });

  it("SKIPS modifySpeed.multiply (deferred)", () => {
    const entry = makeEntry({ structured: { modifySpeed: { multiply: { walk: 2 } } } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.speed).toBeUndefined();
  });

  it("supports the fly: 'walk' sentinel from static.fly: 'walk'", () => {
    const entry = makeEntry({ structured: { modifySpeed: { static: { fly: "walk" } } } });
    const out = toItemCanonical(entry);
    expect(out.bonuses?.speed?.fly).toBe("walk");
  });
});

describe("enrichItemsWithVariantBonuses (CB-2 backfill)", () => {
  // Open5e pre-expands rule-shaped variants like "Defender" into per-base
  // entries ("Defender (Longsword)") whose narrative description carries the
  // "+N" verbiage but whose structured payload has no `bonusWeapon` /
  // `bonusAc`. The variant-expansion pass DOES compute structured bonuses
  // from the underlying rule's `inherits`. The enrichment pass lifts those
  // values onto the matching Open5e entry before the dedup pass drops the
  // variant copy.
  function makeOpen5eDefenderLongsword(): ReturnType<typeof toItemCanonical> {
    const entry: CanonicalEntry = {
      slug: "srd-2024_defender-longsword",
      edition: "2024",
      kind: "item",
      base: {
        key: "srd-2024_defender-longsword",
        name: "Defender (Longsword)",
        document: { key: "srd-2024", name: "SRD 5.2" },
        rarity: "legendary",
        requires_attunement: true,
        desc: "You gain a +3 bonus to attack rolls and damage rolls made with this magic weapon.",
        category: { key: "weapon" },
        weapon: { name: "Longsword" },
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    return toItemCanonical(entry);
  }

  it("backfills bonuses + tier from a name-slug-matching variant entry", () => {
    const item = makeOpen5eDefenderLongsword();
    expect(item.bonuses).toBeUndefined();
    const variants = [
      {
        name: "Defender Longsword",
        bonuses: { weapon_attack: 3, weapon_damage: 3, ac: 1 },
        tier: "major" as const,
        attunement: { required: true },
      },
    ];
    const enriched = enrichItemsWithVariantBonuses([item], variants);
    expect(enriched).toBe(1);
    expect(item.bonuses?.weapon_attack).toBe(3);
    expect(item.bonuses?.weapon_damage).toBe(3);
    expect(item.bonuses?.ac).toBe(1);
    expect(item.tier).toBe("major");
    expect(item.attunement?.required).toBe(true);
  });

  it("matches across paren / space punctuation differences", () => {
    // "Defender (Longsword)" → defender-longsword
    // "Defender Longsword"   → defender-longsword
    const item = makeOpen5eDefenderLongsword();
    const variants = [
      { name: "Defender Longsword", bonuses: { weapon_attack: 3, weapon_damage: 3, ac: 1 } },
    ];
    const enriched = enrichItemsWithVariantBonuses([item], variants);
    expect(enriched).toBe(1);
    expect(item.bonuses?.weapon_attack).toBe(3);
  });

  it("preserves an existing bonuses block (does NOT overwrite)", () => {
    const item = makeOpen5eDefenderLongsword();
    item.bonuses = { weapon_attack: 1 };
    const variants = [
      { name: "Defender Longsword", bonuses: { weapon_attack: 3, weapon_damage: 3, ac: 1 } },
    ];
    enrichItemsWithVariantBonuses([item], variants);
    expect(item.bonuses?.weapon_attack).toBe(1);
    expect(item.bonuses?.ac).toBeUndefined();
  });

  it("returns 0 when no variant matches", () => {
    const item = makeOpen5eDefenderLongsword();
    const variants = [
      { name: "Vorpal Sword", bonuses: { weapon_attack: 3 } },
    ];
    const enriched = enrichItemsWithVariantBonuses([item], variants);
    expect(enriched).toBe(0);
    expect(item.bonuses).toBeUndefined();
  });

  it("ignores variants that carry no bonus / tier / attunement signal", () => {
    const item = makeOpen5eDefenderLongsword();
    const variants = [
      { name: "Defender Longsword" }, // empty
    ];
    const enriched = enrichItemsWithVariantBonuses([item], variants);
    expect(enriched).toBe(0);
    expect(item.bonuses).toBeUndefined();
  });

  it("backfills attunement.required when target has no attunement object", () => {
    const item = makeOpen5eDefenderLongsword();
    item.attunement = undefined;
    const variants = [
      { name: "Defender Longsword", bonuses: { ac: 1 }, attunement: { required: true } },
    ];
    enrichItemsWithVariantBonuses([item], variants);
    expect(item.attunement?.required).toBe(true);
  });
});
