import { describe, it, expect } from "vitest";
import { classSpellCandidates } from "@archivist-gg/dnd5e/spell/spell.access";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

const REG = buildMockRegistry([
  { slug: "fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard", "sorcerer"] } },
  { slug: "cure-wounds", entityType: "spell", data: { name: "Cure Wounds", level: 1, classes: ["cleric"] } },
  { slug: "fire-bolt", entityType: "spell", data: { name: "Fire Bolt", level: 0, classes: ["wizard"] } },
  { slug: "wish", entityType: "spell", data: { name: "Wish", level: 9, classes: ["wizard"] } },
]);

describe("classSpellCandidates", () => {
  it("returns wizard spells at or below maxLevel, excluding already-known", () => {
    const r = classSpellCandidates(REG, ["wizard"], 3, new Set(["fire-bolt"]));
    expect(r.map((e) => e.slug).sort()).toEqual(["fireball"]); // fire-bolt excluded (known); wish excluded (level 9 > 3)
  });

  it("escape hatch (showAll) returns every spell regardless of class/level", () => {
    const r = classSpellCandidates(REG, ["wizard"], 3, new Set(), true);
    expect(r.length).toBe(4);
  });

  it("search filters by name", () => {
    const r = classSpellCandidates(REG, ["wizard"], 9, new Set(), true, "cure");
    expect(r.map((e) => e.slug)).toEqual(["cure-wounds"]);
  });

  it("matches compendium-prefixed class slugs against a spell's bare classes list", () => {
    // Real vault: class slug is `srd-5e_wizard` but each spell's `classes` is bare (`wizard`).
    const r = classSpellCandidates(REG, ["srd-5e_wizard"], 3, new Set());
    expect(r.map((e) => e.slug).sort()).toEqual(["fire-bolt", "fireball"]);
  });
});
