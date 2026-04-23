import { describe, it, expect } from "vitest";
import { PCResolver, stripSlug, collectFeatSlugs } from "../src/modules/pc/pc.resolver";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { Character } from "../src/modules/pc/pc.types";

const BLADESWORN = {
  slug: "bladesworn",
  name: "Bladesworn",
  edition: "2014",
  hit_die: "d10",
  primary_abilities: ["str"],
  saving_throws: ["str", "con"],
  features_by_level: {
    1: [{ name: "Sworn Blade", description: "Your weapon is bound to you." }],
    2: [{ name: "Oath Strike", description: "Extra damage once per turn." }],
    3: [{ name: "Subclass Feature", description: "Choose a subclass." }],
    5: [{ name: "Extra Attack", description: "Attack twice per Attack action." }],
  },
};

const HILL_FOLK = {
  slug: "hill-folk",
  name: "Hill Folk",
  edition: "2014",
  size: "Medium",
  speed: { walk: 25 },
  vision: { darkvision: 60 },
  traits: [
    { name: "Stonecunning", description: "You know stone." },
    { name: "Hill Sturdiness", description: "+1 HP per level." },
  ],
  ability_bonuses: { con: 2, wis: 1 },
};

const DRIFTER = {
  slug: "drifter",
  name: "Drifter",
  edition: "2014",
  feature: { name: "Wanderer's Way", description: "Travel is easy." },
  proficiencies: { skills: ["survival", "insight"], tools: [], languages: [] },
};

describe("stripSlug", () => {
  it("removes wikilink brackets", () => {
    expect(stripSlug("[[rogue]]")).toBe("rogue");
  });
  it("passes through bare slug", () => {
    expect(stripSlug("rogue")).toBe("rogue");
  });
  it("returns null for null input", () => {
    expect(stripSlug(null)).toBeNull();
  });
});

describe("collectFeatSlugs", () => {
  it("pulls feat slugs from class choices", () => {
    const char: Character = minimalCharacter();
    char.class[0].choices = { 4: { feat: "[[sure-step]]" }, 8: { feat: "[[deft-strike]]" } };
    expect(collectFeatSlugs(char).sort()).toEqual(["deft-strike", "sure-step"]);
  });
  it("deduplicates", () => {
    const char: Character = minimalCharacter();
    char.class[0].choices = { 4: { feat: "[[sure-step]]" }, 8: { feat: "[[sure-step]]" } };
    expect(collectFeatSlugs(char)).toEqual(["sure-step"]);
  });
});

describe("PCResolver", () => {
  it("happy path: resolves race/class/background; totalLevel matches", () => {
    const reg = buildMockRegistry([
      { slug: "hill-folk", entityType: "race", data: HILL_FOLK },
      { slug: "bladesworn", entityType: "class", data: BLADESWORN },
      { slug: "drifter", entityType: "background", data: DRIFTER },
    ]);
    const resolver = new PCResolver(reg);
    const char = minimalCharacter();
    char.race = "[[hill-folk]]";
    char.background = "[[drifter]]";

    const { character, warnings } = resolver.resolve(char);
    expect(warnings).toEqual([]);
    expect(character.race?.slug).toBe("hill-folk");
    expect(character.background?.slug).toBe("drifter");
    expect(character.classes[0].entity?.slug).toBe("bladesworn");
    expect(character.totalLevel).toBe(3);
  });

  it("warns on missing slug", () => {
    const reg = buildMockRegistry([]);
    const char = minimalCharacter();
    char.race = "[[ghost-elf]]";
    const { warnings } = new PCResolver(reg).resolve(char);
    expect(warnings.some((w) => w.includes("ghost-elf"))).toBe(true);
  });

  it("warns when slug resolves but with wrong entityType", () => {
    const reg = buildMockRegistry([
      { slug: "bladesworn", entityType: "class", data: BLADESWORN },
    ]);
    const char = minimalCharacter();
    char.race = "[[bladesworn]]"; // wrong type
    const { warnings, character } = new PCResolver(reg).resolve(char);
    expect(character.race).toBeNull();
    expect(warnings.some((w) => w.includes("bladesworn") && w.includes("race"))).toBe(true);
  });

  it("level-filters class features to characterLevel", () => {
    const reg = buildMockRegistry([
      { slug: "bladesworn", entityType: "class", data: BLADESWORN },
    ]);
    const char = minimalCharacter();
    char.class[0].level = 3;
    const { character } = new PCResolver(reg).resolve(char);
    const classFeatureNames = character.features
      .filter((rf) => rf.source.kind === "class")
      .map((rf) => rf.feature.name)
      .sort();
    // Level 1, 2, 3 features present; Level 5 Extra Attack filtered out.
    expect(classFeatureNames).toContain("Sworn Blade");
    expect(classFeatureNames).toContain("Oath Strike");
    expect(classFeatureNames).toContain("Subclass Feature");
    expect(classFeatureNames).not.toContain("Extra Attack");
  });

  it("collects race traits with source { kind: 'race' }", () => {
    const reg = buildMockRegistry([
      { slug: "hill-folk", entityType: "race", data: HILL_FOLK },
      { slug: "bladesworn", entityType: "class", data: BLADESWORN },
    ]);
    const char = minimalCharacter();
    char.race = "[[hill-folk]]";
    const { character } = new PCResolver(reg).resolve(char);
    const raceFeatures = character.features.filter((rf) => rf.source.kind === "race");
    expect(raceFeatures.map((rf) => rf.feature.name).sort()).toEqual(["Hill Sturdiness", "Stonecunning"]);
  });

  it("multiclass: totalLevel sums class levels", () => {
    const reg = buildMockRegistry([
      { slug: "bladesworn", entityType: "class", data: BLADESWORN },
    ]);
    const char = minimalCharacter();
    char.class = [
      { name: "[[bladesworn]]", level: 5, subclass: null, choices: {} },
      { name: "[[bladesworn]]", level: 2, subclass: null, choices: {} },
    ];
    const { character } = new PCResolver(reg).resolve(char);
    expect(character.totalLevel).toBe(7);
  });
});

function minimalCharacter(): Character {
  return {
    name: "Grendal",
    edition: "2014",
    race: null,
    subrace: null,
    background: null,
    class: [{ name: "[[bladesworn]]", level: 3, subclass: null, choices: {} }],
    abilities: { str: 14, dex: 10, con: 13, int: 10, wis: 12, cha: 8 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [],
    overrides: {},
    state: {
      hp: { current: 24, max: 24, temp: 0 },
      hit_dice: {},
      spell_slots: {},
      concentration: null,
      conditions: [],
    },
  };
}
