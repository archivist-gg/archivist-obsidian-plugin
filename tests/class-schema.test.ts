import { describe, it, expect } from "vitest";
import { classEntitySchema } from "../src/modules/class/class.schema";

const minimalClass = {
  slug: "rogue",
  name: "Rogue",
  edition: "2014",
  source: "SRD 5.1",
  description: "Stealthy.",
  hit_die: "d8",
  primary_abilities: ["dex"],
  saving_throws: ["dex", "int"],
  proficiencies: {
    armor: ["light"],
    weapons: { fixed: ["simple", "hand-crossbow", "longsword", "rapier", "shortsword"] },
    tools: { fixed: ["thieves-tools"] },
  },
  skill_choices: { count: 4, from: ["stealth", "deception"] },
  starting_equipment: [{ kind: "fixed", label: "leather armor", grants: [{ item: "leather-armor" }] }],
  spellcasting: null,
  subclass_level: 3,
  subclass_feature_name: "Roguish Archetype",
  weapon_mastery: null,
  epic_boon_level: null,
  table: { "1": { prof_bonus: 2, feature_ids: ["expertise"] } },
  features_by_level: { "1": [{ name: "Expertise", description: "..." }] },
  resources: [],
};

describe("classEntitySchema", () => {
  it("accepts a minimal valid class", () => {
    expect(classEntitySchema.safeParse(minimalClass).success).toBe(true);
  });

  it("accepts conditional weapon proficiency (2024 Rogue shape)", () => {
    const input = {
      ...minimalClass,
      proficiencies: {
        ...minimalClass.proficiencies,
        weapons: {
          categories: ["simple"],
          conditional: [{ category: "martial", where_property: ["finesse", "light"] }],
        },
      },
    };
    expect(classEntitySchema.safeParse(input).success).toBe(true);
  });

  it("accepts 2024 weapon mastery + epic boon level", () => {
    const input = {
      ...minimalClass,
      edition: "2024",
      weapon_mastery: { starting_count: 2, scaling: { "5": 3 } },
      epic_boon_level: 19,
    };
    expect(classEntitySchema.safeParse(input).success).toBe(true);
  });

  it("rejects hit_die d4", () => {
    expect(classEntitySchema.safeParse({ ...minimalClass, hit_die: "d4" }).success).toBe(false);
  });

  it("rejects saving_throws with wrong length", () => {
    expect(classEntitySchema.safeParse({ ...minimalClass, saving_throws: ["dex"] }).success).toBe(false);
  });

  it("rejects weapon proficiency with nothing declared", () => {
    const input = { ...minimalClass, proficiencies: { ...minimalClass.proficiencies, weapons: {} } };
    expect(classEntitySchema.safeParse(input).success).toBe(false);
  });
});

describe("classEntitySchema — selection pools / tabs (Phase 2)", () => {
  it("accepts selection_pools, pool_grants and tabs", () => {
    const c = {
      ...minimalClass,
      selection_pools: [{
        id: "interdict-boons", label: "Interdict Boons",
        source: { entity_type: "optional-feature", where: { feature_type: "interdict-boon", available_to: "self" } },
        count: { column: "Interdict Boons" }, replaceable: true,
      }],
      pool_grants: [{ pool: "interdict-boons", grants: [{ feature: "[[axiomatic-seals]]", at_level: 7 }] }],
      tabs: [{ id: "boons", label: "Interdict Boons", renders: { pool: "interdict-boons" } }],
    };
    const r = classEntitySchema.safeParse(c);
    expect(r.success && (r.data as { selection_pools?: unknown }).selection_pools !== undefined).toBe(true);
  });

  it("still accepts a class with no pool fields (all optional)", () => {
    expect(classEntitySchema.safeParse(minimalClass).success).toBe(true);
  });
});
