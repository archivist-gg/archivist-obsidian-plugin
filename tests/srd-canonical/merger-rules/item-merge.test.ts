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
