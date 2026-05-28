import { describe, it, expect } from "vitest";
import { toBackgroundCanonical } from "../../../tools/srd-canonical/merger-rules/background-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("backgroundMergeRule", () => {
  it("produces canonical Background from Open5e v2 benefits[] (Acolyte, 2014)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_acolyte",
      edition: "2014",
      kind: "background",
      base: {
        key: "acolyte",
        name: "Acolyte",
        desc: "You have spent your life in the service of a temple.",
        document: { key: "srd-2014", name: "SRD 5.1" },
        benefits: [
          { name: "Skill Proficiencies", desc: "Insight, Religion", type: "skill_proficiency" },
          { name: "Languages", desc: "Two of your choice", type: "language" },
          {
            name: "Equipment",
            desc: "A holy symbol, a prayer book, 5 sticks of incense, vestments, a set of common clothes, and a pouch containing 15 gp",
            type: "equipment",
          },
          {
            name: "Shelter of the Faithful",
            desc: "As an acolyte, you command the respect of those who share your faith.",
            type: "feature",
          },
        ],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.slug).toBe("srd-5e_acolyte");
    expect(out.edition).toBe("2014");
    expect(out.skill_proficiencies).toEqual(["insight", "religion"]);
    expect(out.feature.name).toBe("Shelter of the Faithful");
    expect(out.feature.description).toContain("acolyte");
    expect(out.origin_feat).toBeNull();
    expect(out.ability_score_increases).toBeNull();
  });

  it("uses 'description' (not 'desc') in feature object — runtime field name", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_acolyte",
      edition: "2014",
      kind: "background",
      base: {
        key: "acolyte",
        name: "Acolyte",
        desc: "",
        document: { key: "srd-2014", name: "SRD 5.1" },
        benefits: [{ name: "Some Feature", desc: "Feature description.", type: "feature" }],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect((out.feature as { description: string }).description).toBe("Feature description.");
    expect(out.feature.name).toBe("Some Feature");
  });

  it("emits language_proficiencies as discriminated union (choice for 'Two of your choice')", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_acolyte",
      edition: "2014",
      kind: "background",
      base: {
        key: "acolyte",
        name: "Acolyte",
        desc: "x",
        document: { key: "srd-2014", name: "SRD 5.1" },
        benefits: [
          { name: "Languages", desc: "Two of your choice", type: "language" },
          { name: "Feature", desc: "F.", type: "feature" },
        ],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.language_proficiencies.length).toBeGreaterThan(0);
    const first = out.language_proficiencies[0];
    expect(first.kind).toBe("choice");
    if (first.kind === "choice") {
      expect(first.count).toBe(2);
      expect(first.from).toBe("any");
    }
  });

  it("emits tool_proficiencies as fixed kind (Calligrapher's Supplies)", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-2024_acolyte",
      edition: "2024",
      kind: "background",
      base: {
        key: "srd-2024_acolyte",
        name: "Acolyte",
        desc: "x",
        document: { key: "srd-2024", name: "SRD 5.2" },
        benefits: [
          { name: "Tool Proficiency", desc: "Calligrapher's Supplies", type: "tool_proficiency" },
          { name: "Feature", desc: "F.", type: "feature" },
        ],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.tool_proficiencies.length).toBe(1);
    const tp = out.tool_proficiencies[0];
    expect(tp.kind).toBe("fixed");
    if (tp.kind === "fixed") {
      expect(tp.items).toContain("calligrapher's-supplies");
    }
  });

  it("emits equipment as array of items + currency entries", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_acolyte",
      edition: "2014",
      kind: "background",
      base: {
        key: "acolyte",
        name: "Acolyte",
        desc: "x",
        document: { key: "srd-2014", name: "SRD 5.1" },
        benefits: [
          {
            name: "Equipment",
            desc: "A holy symbol, a prayer book, 5 sticks of incense, vestments, a set of common clothes, and a pouch containing 15 gp",
            type: "equipment",
          },
          { name: "Feature", desc: "F.", type: "feature" },
        ],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.equipment.length).toBeGreaterThan(2);
    const currency = out.equipment.find((e) => "kind" in e && e.kind === "currency");
    expect(currency).toBeDefined();
    if (currency && "kind" in currency && currency.kind === "currency") {
      expect(currency.gp).toBe(15);
    }
  });

  it("populates ability_score_increases pool from 2024 ability_score benefit", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-2024_acolyte",
      edition: "2024",
      kind: "background",
      base: {
        key: "srd-2024_acolyte",
        name: "Acolyte",
        desc: "x",
        document: { key: "srd-2024", name: "SRD 5.2" },
        benefits: [
          { name: "Ability Scores", desc: "Intelligence, Wisdom, Charisma", type: "ability_score" },
          { name: "Feature", desc: "F.", type: "feature" },
        ],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.ability_score_increases).not.toBeNull();
    expect(out.ability_score_increases?.pool).toEqual(["int", "wis", "cha"]);
  });

  it("populates origin_feat as compendium wikilink from 2024 feat benefit", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-2024_acolyte",
      edition: "2024",
      kind: "background",
      base: {
        key: "srd-2024_acolyte",
        name: "Acolyte",
        desc: "x",
        document: { key: "srd-2024", name: "SRD 5.2" },
        benefits: [
          { name: "Feat", desc: "Magic Initiate (Cleric)", type: "feat" },
          { name: "Feature", desc: "F.", type: "feature" },
        ],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    expect(out.origin_feat).toBe("[[SRD 2024/Feats/Magic Initiate (Cleric)]]");
  });

  it("falls back to placeholder feature description when benefits[] has no feature entry", () => {
    const canonical: CanonicalEntry = {
      slug: "srd-5e_empty",
      edition: "2014",
      kind: "background",
      base: {
        key: "empty",
        name: "Empty",
        desc: "x",
        document: { key: "srd-2014", name: "SRD 5.1" },
        benefits: [],
      } as never,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toBackgroundCanonical(canonical);
    // Schema requires non-empty name + description.
    expect(out.feature.name.length).toBeGreaterThan(0);
    expect(out.feature.description.length).toBeGreaterThan(0);
  });
});
