import { describe, it, expect } from "vitest";
import { buildScrollSpellCandidates } from "../packages/obsidian/src/modules/pc/components/inventory/scroll-spell-picker";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

const reg = buildMockRegistry([
  { slug: "srd-5e_spell_shield", name: "Shield", entityType: "spell",
    data: { level: 1, edition: "2014" }, compendium: "SRD 5e" },
  { slug: "srd-2024_spell_shield", name: "Shield", entityType: "spell",
    data: { level: 1, edition: "2024" }, compendium: "SRD 2024" },
]);

describe("buildScrollSpellCandidates visibility (F4)", () => {
  it("default (no hidden set) keeps the pre-existing behavior", () => {
    expect(buildScrollSpellCandidates(reg, 1, "2024").map((e) => e.slug))
      .toEqual(["srd-2024_spell_shield"]); // edition gate, unchanged
  });
  it("a hidden compendium's spells are dropped", () => {
    const out = buildScrollSpellCandidates(reg, 1, "2014", new Set(["SRD 5e"]));
    expect(out.map((e) => e.slug)).toEqual([]);
  });
  it("keepSlug exempts ONLY the hidden gate, not level/edition", () => {
    const kept = buildScrollSpellCandidates(reg, 1, "2014", new Set(["SRD 5e"]), "srd-5e_spell_shield");
    expect(kept.map((e) => e.slug)).toEqual(["srd-5e_spell_shield"]);
    // wrong level still excluded even as keepSlug:
    const wrongLevel = buildScrollSpellCandidates(reg, 2, "2014", new Set(["SRD 5e"]), "srd-5e_spell_shield");
    expect(wrongLevel).toEqual([]);
  });
});
