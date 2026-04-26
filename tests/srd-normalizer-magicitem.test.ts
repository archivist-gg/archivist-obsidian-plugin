import { describe, it, expect } from "vitest";
import { normalizeSrdItem } from "../src/shared/entities/srd-normalizer";

// ---------------------------------------------------------------------------
// Pass-through of structured mechanical fields added by the augmenter
// ---------------------------------------------------------------------------

describe("normalizeSrdItem — structured-fields passthrough", () => {
  it("preserves bonuses.ac on output", () => {
    const augmented = {
      name: "Bracers of Defense",
      type: "Wondrous item",
      rarity: "rare",
      desc: "While wearing these bracers, you gain a +2 bonus to AC.",
      requires_attunement: "requires attunement",
      bonuses: { ac: 2 },
      tier: "major",
    };
    const out = normalizeSrdItem(augmented);
    expect(out.bonuses).toEqual({ ac: 2 });
    expect(out.tier).toBe("major");
    expect(out.entries).toEqual([
      "While wearing these bracers, you gain a +2 bonus to AC.",
    ]);
    expect(out.desc).toBeUndefined();
  });

  it("preserves resist/immune/vulnerable/condition_immune", () => {
    const out = normalizeSrdItem({
      name: "Ring of Cold Resistance",
      desc: "You have resistance to cold damage.",
      resist: ["cold"],
      immune: ["fire"],
      vulnerable: ["thunder"],
      condition_immune: ["charmed"],
    });
    expect(out.resist).toEqual(["cold"]);
    expect(out.immune).toEqual(["fire"]);
    expect(out.vulnerable).toEqual(["thunder"]);
    expect(out.condition_immune).toEqual(["charmed"]);
  });

  it("preserves attached_spells", () => {
    const out = normalizeSrdItem({
      name: "Cape of the Mountebank",
      desc: "Cast dimension door once per day.",
      attached_spells: { daily: { "1": ["dimension door"] } },
    });
    expect(out.attached_spells).toEqual({
      daily: { "1": ["dimension door"] },
    });
  });

  it("preserves charges (number) and charges (object) shapes", () => {
    const num = normalizeSrdItem({ name: "X", charges: 3 });
    expect(num.charges).toBe(3);
    const obj = normalizeSrdItem({
      name: "Wand",
      charges: { max: 7, recharge: "dawn", recharge_amount: "1d6 + 1" },
    });
    expect(obj.charges).toEqual({
      max: 7,
      recharge: "dawn",
      recharge_amount: "1d6 + 1",
    });
  });

  it("preserves grants object", () => {
    const out = normalizeSrdItem({
      name: "X",
      grants: { languages: true, proficiency: true },
    });
    expect(out.grants).toEqual({ languages: true, proficiency: true });
  });

  it("preserves base_item", () => {
    const out = normalizeSrdItem({ name: "Dagger +1", base_item: "Dagger" });
    expect(out.base_item).toBe("Dagger");
  });
});

// ---------------------------------------------------------------------------
// Canonical attunement vs legacy requires_attunement
// ---------------------------------------------------------------------------

describe("normalizeSrdItem — attunement precedence", () => {
  it("keeps canonical attunement object when both are present", () => {
    const out = normalizeSrdItem({
      name: "Robe of the Archmagi",
      desc: "An elegant robe.",
      requires_attunement: "requires attunement by a sorcerer, warlock, or wizard",
      attunement: {
        required: true,
        restriction: "by a sorcerer, warlock, or wizard",
        tags: [{ class: "sorcerer" }, { class: "warlock" }, { class: "wizard" }],
      },
    });
    expect(out.attunement).toEqual({
      required: true,
      restriction: "by a sorcerer, warlock, or wizard",
      tags: [{ class: "sorcerer" }, { class: "warlock" }, { class: "wizard" }],
    });
    // Legacy field still stripped.
    expect(out.requires_attunement).toBeUndefined();
  });

  it("falls back to deriving attunement from requires_attunement when no canonical form", () => {
    const out = normalizeSrdItem({
      name: "Holy Avenger",
      desc: "A sword.",
      requires_attunement: "requires attunement by a paladin",
    });
    expect(out.attunement).toBe("by a paladin");
  });

  it("strips requires_attunement after honoring canonical form", () => {
    const out = normalizeSrdItem({
      name: "X",
      requires_attunement: "requires attunement",
      attunement: { required: true },
    });
    expect(out.requires_attunement).toBeUndefined();
    expect(out.attunement).toEqual({ required: true });
  });
});

// ---------------------------------------------------------------------------
// Integration: round-trip an augmented record through the schema
// ---------------------------------------------------------------------------

describe("normalizeSrdItem — schema round-trip", () => {
  it("output for an augmented Bracers of Defense validates as ItemEntity", async () => {
    const { itemEntitySchema } = await import("../src/modules/item/item.schema");
    const out = normalizeSrdItem({
      name: "Bracers of Defense",
      type: "Wondrous item",
      rarity: "rare",
      desc: "While wearing these bracers, you gain a +2 bonus to AC.",
      requires_attunement: "requires attunement",
      bonuses: { ac: 2 },
      tier: "major",
      attunement: { required: true },
    });
    // Reshape `entries` to satisfy the schema's `unknown[]` (already an array).
    const result = itemEntitySchema.safeParse(out);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bonuses?.ac).toBe(2);
      expect(result.data.tier).toBe("major");
    }
  });
});
