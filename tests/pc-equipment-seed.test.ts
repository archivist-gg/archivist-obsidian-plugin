import { describe, it, expect } from "vitest";
import { resolveGrants, type SeedRegistry } from "../packages/obsidian/src/modules/pc/builder/equipment-seed";

const reg: SeedRegistry = {
  lookup: (bare) => {
    const map: Record<string, { fullSlug: string; entityType: string; packContents?: string[] }> = {
      "chain-mail": { fullSlug: "srd-2024_chain-mail", entityType: "armor" },
      "shield": { fullSlug: "srd-2024_shield", entityType: "armor" }, // armor with category "shield"
      "greatsword": { fullSlug: "srd-2024_greatsword", entityType: "weapon" },
      "dungeoneers-pack": { fullSlug: "srd-2024_dungeoneers-pack", entityType: "item", packContents: ["backpack", "crowbar"] },
      "backpack": { fullSlug: "srd-2024_backpack", entityType: "item" },
      "crowbar": { fullSlug: "srd-2024_crowbar", entityType: "item" },
      "pouch": { fullSlug: "srd-2024_pouch", entityType: "item" },
    };
    return map[bare] ?? null;
  },
  isShield: (bare) => bare === "shield",
};

describe("resolveGrants", () => {
  it("resolves items, sums gold, auto-equips armor, expands packs", () => {
    const { entries, gold } = resolveGrants(
      [{ item: "chain-mail" }, { item: "greatsword" }, { item: "dungeoneers-pack" }, { gold: 4 }],
      {}, reg,
    );
    const slugs = entries.map((e) => e.slug);
    expect(slugs).toContain("srd-2024_chain-mail");
    expect(entries.find((e) => e.slug === "srd-2024_chain-mail")?.equipped).toBe(true);
    expect(entries.find((e) => e.slug === "srd-2024_chain-mail")?.slot).toBe("armor");
    expect(slugs).toContain("srd-2024_backpack"); // pack expanded
    expect(slugs).not.toContain("srd-2024_dungeoneers-pack"); // pack itself not seeded
    expect(gold).toBe(4);
  });

  it("resolves a category grant from the nested pick map", () => {
    const { entries } = resolveGrants(
      [{ category: "martial-weapon" }, { item: "shield" }],
      { "cat-0": "srd-2024_greatsword" }, reg, ["cat-0"],
    );
    expect(entries.map((e) => e.slug)).toContain("srd-2024_greatsword");
    expect(entries.find((e) => e.slug === "srd-2024_shield")?.slot).toBe("shield");
  });

  it("skips unresolved bare slugs (graceful)", () => {
    const { entries } = resolveGrants([{ item: "does-not-exist" }], {}, reg);
    expect(entries.length).toBe(0);
  });

  // Phase-1 slug namespacing (Task 3): a category pick feeds pushFull a full slug,
  // which strips to a bare name before reg.lookup. It must handle the new 3-part
  // `<prefix>_<type>_<name>` shape as well as the legacy 2-part form.
  it("strips a 3-part namespaced category pick down to the bare lookup key", () => {
    const { entries } = resolveGrants(
      [{ category: "martial-weapon" }],
      { "cat-0": "srd-2024_weapon_greatsword" }, reg, ["cat-0"],
    );
    expect(entries.map((e) => e.slug)).toContain("srd-2024_greatsword");
  });
});

// R4-G3b Task 10: the converter records the coin INSIDE a granted container as
// `contains_value`, in COPPER (1500 = 15 gp). Before this task the seeder read
// only `{gold}` grants and the copper was dropped on the floor.
describe("contains_value seeds as gold (R4-G3b §9)", () => {
  it("1500 cp inside a pouch is 15 gp", () => {
    const { gold, entries } = resolveGrants([{ item: "pouch", contains_value: 1500 }], {}, reg);
    expect(gold).toBe(15);                          // RED FIRST: read 0 before Task 10
    expect(entries.map((e) => e.slug)).toContain("srd-2024_pouch");
  });

  it("the coin lands even when the container slug is unresolved (placement OUTSIDE pushBare)", () => {
    // The converter's `purse` carrier resolves to nothing (no Purse.md in either
    // corpus), so a seed line inside pushBare would lose the coin with the container.
    const { gold, entries } = resolveGrants([{ item: "does-not-exist", contains_value: 1500 }], {}, reg);
    expect(gold).toBe(15);
    expect(entries).toHaveLength(0);
  });

  it("{gold: 15} and a 1500-cp pouch produce the same wallet", () => {
    expect(resolveGrants([{ gold: 15 }], {}, reg).gold)
      .toBe(resolveGrants([{ item: "pouch", contains_value: 1500 }], {}, reg).gold);
  });

  it("worth_value is NEVER seeded", () => {
    // A CONTROL, not a RED-first case: it was green before Task 10 too (nothing
    // was seeded at all). It is the fixture that kills the `?? g.worth_value` mutant,
    // which would mint 10 gp out of Far Traveler's jewel.
    expect(resolveGrants([{ item: "pouch", worth_value: 1000 }], {}, reg).gold).toBe(0);
  });
});
