import { describe, it, expect } from "vitest";
import { resolveGrants, type SeedRegistry } from "../src/modules/pc/builder/equipment-seed";

const reg: SeedRegistry = {
  lookup: (bare) => {
    const map: Record<string, { fullSlug: string; entityType: string; packContents?: string[] }> = {
      "chain-mail": { fullSlug: "srd-2024_chain-mail", entityType: "armor" },
      "shield": { fullSlug: "srd-2024_shield", entityType: "armor" }, // armor with category "shield"
      "greatsword": { fullSlug: "srd-2024_greatsword", entityType: "weapon" },
      "dungeoneers-pack": { fullSlug: "srd-2024_dungeoneers-pack", entityType: "item", packContents: ["backpack", "crowbar"] },
      "backpack": { fullSlug: "srd-2024_backpack", entityType: "item" },
      "crowbar": { fullSlug: "srd-2024_crowbar", entityType: "item" },
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
});
