import { describe, it, expect } from "vitest";
import { normalizeSrdClass } from "../src/modules/class/class.normalizer";

const minimalOpen5eRogue = {
  name: "Rogue",
  slug: "rogue",
  desc:
    "### Expertise\n\nAt 1st level, choose two of your skill proficiencies.\n\n" +
    "### Sneak Attack\n\nBeginning at 1st level, you deal extra damage.\n\n" +
    "### Cunning Action\n\nStarting at 2nd level, you gain bonus action dash/disengage/hide.",
  hit_dice: "1d8",
  prof_armor: "Light armor",
  prof_weapons: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
  prof_tools: "Thieves' tools",
  prof_saving_throws: "Dexterity, Intelligence",
  prof_skills: "Choose four from Acrobatics, Deception, Investigation, Sleight of Hand, Stealth",
  equipment: "* (a) a rapier or (b) a shortsword\n* (a) a shortbow and quiver",
  table: "| Level | Proficiency Bonus | Sneak Attack | Features |\n|-|-|-|-|\n| 1st | +2 | 1d6 | Expertise, Sneak Attack |\n| 2nd | +2 | 1d6 | Cunning Action |",
  subtypes_name: "Roguish Archetypes",
  document__slug: "wotc-srd",
};

describe("normalizeSrdClass", () => {
  it("normalizes a minimal SRD rogue", () => {
    const out = normalizeSrdClass(minimalOpen5eRogue);
    expect(out.frontmatter.slug).toBe("rogue");
    expect(out.frontmatter.entity_type).toBe("class");
    expect(out.data.hit_die).toBe("d8");
    expect(out.data.saving_throws).toEqual(["dex", "int"]);
    expect(out.data.proficiencies.armor).toEqual(["light"]);
    expect(out.data.skill_choices.count).toBe(4);
    expect(out.data.skill_choices.from).toContain("stealth");
    expect(out.data.table[1]?.prof_bonus).toBe(2);
    expect(out.data.table[2]?.feature_ids).toContain("cunning-action");
  });

  it("places unattributed features at level 1", () => {
    const input = { ...minimalOpen5eRogue, desc: "### Thieves' Cant\n\nYou can speak in code." };
    const out = normalizeSrdClass(input);
    expect(out.data.features_by_level[1]).toBeDefined();
    expect(out.data.features_by_level[1][0]?.name).toBe("Thieves' Cant");
  });

  it("attributes features to the level in 'Starting at Xth level' prose", () => {
    const out = normalizeSrdClass(minimalOpen5eRogue);
    const lvl2 = out.data.features_by_level[2] ?? [];
    expect(lvl2.some((f) => f.name === "Cunning Action")).toBe(true);
  });

  it("throws on unrecognized hit_dice", () => {
    expect(() => normalizeSrdClass({ ...minimalOpen5eRogue, hit_dice: "d3" })).toThrow();
  });

  it("defaults edition to 2014 and source to SRD 5.1", () => {
    const out = normalizeSrdClass(minimalOpen5eRogue);
    expect(out.data.edition).toBe("2014");
    expect(out.data.source).toBe("SRD 5.1");
  });
});
