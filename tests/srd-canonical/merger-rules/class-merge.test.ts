import { describe, it, expect } from "vitest";
import { toClassCanonical } from "../../../tools/srd-canonical/merger-rules/class-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseEntry = (overrides: Partial<CanonicalEntry> & { base: unknown }): CanonicalEntry => ({
  slug: overrides.slug ?? "srd-5e_fighter",
  edition: overrides.edition ?? "2014",
  kind: "class",
  base: overrides.base as never,
  structured: overrides.structured ?? null,
  activation: null,
  overlay: overrides.overlay ?? null,
});

describe("class-merge: Open5e v2 class shape", () => {
  it("emits lowercase d10 hit_die (was uppercase D10 'hit_dice')", () => {
    const result = toClassCanonical(baseEntry({
      base: {
        key: "srd_fighter",
        name: "Fighter",
        desc: "",
        hit_dice: "D10",
        subclass_of: null,
        features: [],
        saving_throws: [{ name: "Strength" }, { name: "Constitution" }],
      },
    })) as { hit_die: string };
    expect(result.hit_die).toBe("d10");
  });

  it("buckets features by gained_at[].level (filters CLASS_LEVEL_FEATURE, drops [Column data] CLASS_TABLE_DATA)", () => {
    const result = toClassCanonical(baseEntry({
      base: {
        key: "srd_fighter",
        name: "Fighter",
        desc: "",
        hit_dice: "D10",
        subclass_of: null,
        features: [
          {
            key: "srd_fighter_ability-score-improvement",
            name: "Ability Score Improvement",
            desc: "Boost an ability.",
            feature_type: "CLASS_LEVEL_FEATURE",
            gained_at: [{ level: 4, detail: null }, { level: 6, detail: null }, { level: 8, detail: null }],
            data_for_class_table: [],
          },
          {
            key: "srd_fighter_cantrips-known",
            name: "Cantrips Known",
            desc: "[Column data]",
            feature_type: "CLASS_TABLE_DATA",
            gained_at: [],
            data_for_class_table: [{ level: 1, column_value: "3" }, { level: 4, column_value: "4" }],
          },
        ],
        saving_throws: [{ name: "Strength" }, { name: "Constitution" }],
      },
    })) as { features_by_level: Record<string, Array<{ name: string }>> };
    const allFeatureNames = Object.values(result.features_by_level)
      .flat()
      .map((f) => f.name);
    expect(allFeatureNames).not.toContain("Cantrips Known");
    expect(allFeatureNames.filter((n) => n === "Ability Score Improvement").length).toBeGreaterThanOrEqual(3);
  });

  it("reads saving_throws[{name}] and shortens to 3-letter ability keys", () => {
    const result = toClassCanonical(baseEntry({
      base: {
        key: "srd_fighter",
        name: "Fighter",
        desc: "",
        hit_dice: "D10",
        subclass_of: null,
        saving_throws: [{ name: "Strength" }, { name: "Constitution" }],
        features: [],
      },
    })) as { saving_throws: string[] };
    expect(result.saving_throws.sort()).toEqual(["con", "str"]);
  });

  it("reconstructs table rows from features[].data_for_class_table[]", () => {
    const result = toClassCanonical(baseEntry({
      base: {
        key: "srd_wizard",
        name: "Wizard",
        desc: "",
        hit_dice: "D6",
        subclass_of: null,
        saving_throws: [{ name: "Intelligence" }, { name: "Wisdom" }],
        features: [
          {
            key: "srd_wizard_proficiency-bonus",
            name: "Proficiency Bonus",
            desc: "[Column data]",
            feature_type: "PROFICIENCY_BONUS",
            gained_at: [],
            data_for_class_table: [
              { level: 1, column_value: "+2" },
              { level: 5, column_value: "+3" },
              { level: 9, column_value: "+4" },
              { level: 13, column_value: "+5" },
              { level: 17, column_value: "+6" },
            ],
          },
          {
            key: "srd_wizard_cantrips-known",
            name: "Cantrips Known",
            desc: "[Column data]",
            feature_type: "CLASS_TABLE_DATA",
            gained_at: [],
            data_for_class_table: [
              { level: 1, column_value: "3" },
              { level: 4, column_value: "4" },
              { level: 10, column_value: "5" },
            ],
          },
        ],
      },
    })) as { table: Record<string, { prof_bonus: number; columns?: Record<string, unknown>; feature_ids: string[] }> };
    expect(result.table["1"].prof_bonus).toBe(2);
    expect(result.table["5"].prof_bonus).toBe(3);
    expect(result.table["1"].columns?.["Cantrips Known"]).toBe("3");
    expect(result.table["4"].columns?.["Cantrips Known"]).toBe("4");
  });

  it("assigns feature_ids from CLASS_LEVEL_FEATURE features at each gained_at level", () => {
    const result = toClassCanonical(baseEntry({
      base: {
        key: "srd_fighter",
        name: "Fighter",
        desc: "",
        hit_dice: "D10",
        subclass_of: null,
        saving_throws: [{ name: "Strength" }, { name: "Constitution" }],
        features: [
          {
            key: "srd_fighter_action-surge",
            name: "Action Surge",
            desc: "Take one extra action.",
            feature_type: "CLASS_LEVEL_FEATURE",
            gained_at: [{ level: 2, detail: null }],
            data_for_class_table: [],
          },
          {
            key: "srd_fighter_proficiency-bonus",
            name: "Proficiency Bonus",
            desc: "[Column data]",
            feature_type: "PROFICIENCY_BONUS",
            gained_at: [],
            data_for_class_table: [{ level: 2, column_value: "+2" }],
          },
        ],
      },
    })) as { table: Record<string, { feature_ids: string[] }> };
    expect(result.table["2"].feature_ids).toContain("action-surge");
  });

  it("emits required scalar fields (slug, name, edition, source, description, hit_die)", () => {
    const result = toClassCanonical(baseEntry({
      slug: "srd-5e_fighter",
      base: {
        key: "srd_fighter",
        name: "Fighter",
        desc: "Master of combat.",
        hit_dice: "D10",
        subclass_of: null,
        saving_throws: [{ name: "Strength" }, { name: "Constitution" }],
        features: [],
      },
    })) as Record<string, unknown>;
    expect(result.slug).toBe("srd-5e_fighter");
    expect(result.name).toBe("Fighter");
    expect(result.edition).toBe("2014");
    expect(result.source).toBe("SRD 5.1");
    expect(result.description).toBe("Master of combat.");
    expect(result.hit_die).toBe("d10");
  });

  it("emits primary_abilities, proficiencies, skill_choices, starting_equipment, subclass_level, weapon_mastery, epic_boon_level, resources defaults", () => {
    const result = toClassCanonical(baseEntry({
      base: {
        key: "srd_fighter",
        name: "Fighter",
        desc: "",
        hit_dice: "D10",
        subclass_of: null,
        saving_throws: [{ name: "Strength" }, { name: "Constitution" }],
        features: [],
      },
    })) as Record<string, unknown>;
    expect(Array.isArray(result.primary_abilities)).toBe(true);
    expect((result.primary_abilities as string[]).length).toBeGreaterThanOrEqual(1);
    expect(typeof result.proficiencies).toBe("object");
    expect(typeof result.skill_choices).toBe("object");
    expect(Array.isArray(result.starting_equipment)).toBe(true);
    expect(typeof result.subclass_level).toBe("number");
    expect(typeof result.subclass_feature_name).toBe("string");
    expect(result.weapon_mastery).toBeNull();
    expect(result.epic_boon_level).toBeNull();
    expect(Array.isArray(result.resources)).toBe(true);
    expect(result.spellcasting === null || typeof result.spellcasting === "object").toBe(true);
  });

  it("populates spellcasting from caster_type=FULL", () => {
    const result = toClassCanonical(baseEntry({
      slug: "srd-5e_wizard",
      base: {
        key: "srd_wizard",
        name: "Wizard",
        desc: "",
        hit_dice: "D6",
        subclass_of: null,
        caster_type: "FULL",
        saving_throws: [{ name: "Intelligence" }, { name: "Wisdom" }],
        features: [],
      },
    })) as { spellcasting: { ability: string; preparation: string; spell_list: string } | null };
    expect(result.spellcasting).not.toBeNull();
    expect(result.spellcasting?.ability).toBe("int");
    expect(result.spellcasting?.spell_list.length).toBeGreaterThan(0);
  });
});
