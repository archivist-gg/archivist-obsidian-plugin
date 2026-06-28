import { describe, it, expect } from "vitest";
import { PCResolver } from "../packages/obsidian/src/modules/pc/pc.resolver";

function mkEntities(map: Record<string, Record<string, unknown>[]>) {
  return {
    getByTypeAndSlug: (type: string, slug: string) => {
      const e = (map[type] ?? []).find((x) => x.slug === slug);
      return e ? { slug, name: e.name, type, data: e } : undefined;
    },
    search: (_q: string, type: string) =>
      (map[type] ?? []).map((e) => ({ slug: e.slug, name: e.name, type, data: e })),
  } as never;
}

const reaver = {
  slug: "reaver", name: "Reaver", edition: "2014", source: "hb", description: "",
  hit_die: "d10", primary_abilities: ["cha"], saving_throws: ["con", "cha"],
  proficiencies: { armor: [], weapons: { categories: ["martial"] } },
  skill_choices: { count: 2, from: ["deception"] },
  starting_equipment: [], spellcasting: null, subclass_level: 3,
  subclass_feature_name: "Diabolic Contract", weapon_mastery: null, epic_boon_level: null,
  table: { 2: { prof_bonus: 2, feature_ids: [], columns: { "Interdict Boons": 1 } } },
  features_by_level: {}, resources: [],
  selection_pools: [{
    id: "interdict-boons", label: "Interdict Boons",
    source: { entity_type: "optional-feature", where: { feature_type: "interdict-boon", available_to: "self" } },
    count: { column: "Interdict Boons" },
  }],
};
const baleful = {
  slug: "baleful-glare", name: "Baleful Glare", edition: "2014", source: "hb",
  feature_type: "interdict-boon", description: "", effects: [], prerequisites: [],
  available_to: ["[[reaver]]"],
};

describe("PCResolver — pools", () => {
  it("populates resolved.pools from the class declaration", () => {
    const entities = mkEntities({ class: [reaver], "optional-feature": [baleful] });
    const character = {
      name: "X", edition: "2014", race: null, subrace: null, background: null,
      class: [{ name: "[[reaver]]", level: 2, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      ability_method: "manual", skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] }, equipment: [], overrides: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {},
        concentration: null, conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
    };
    const { character: resolved } = new PCResolver(entities).resolve(character as never);
    expect(resolved.pools).toHaveLength(1);
    expect(resolved.pools[0].id).toBe("interdict-boons");
    expect(resolved.pools[0].available.map((e) => e.slug)).toEqual(["baleful-glare"]);
  });
});
