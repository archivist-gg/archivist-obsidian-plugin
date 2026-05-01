import { describe, it, expect } from "vitest";
import { toItemCanonical } from "../../../tools/srd-canonical/merger-rules/item-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

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
    expect(out.requires_attunement).toBe(true);
    expect(out.description).toContain("+1 bonus to AC");
    expect(out.bonuses?.ac).toBe(1);
    expect(out.bonuses?.saving_throw).toBe(1);
    expect(out.bonuses?.attack).toBeUndefined();
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
    expect(out.requires_attunement).toBe(false);
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

  it("surfaces structured-rules bonusWeapon to bonuses.attack", () => {
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
    expect(result.bonuses?.attack).toBe("+1");
  });
});
