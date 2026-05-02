import { describe, it, expect } from "vitest";
import { projectToRuntime } from "../../tools/srd-canonical/to-runtime";

describe("projectToRuntime", () => {
  it("drops unknown fields for items but preserves description (AI consumption)", () => {
    const item = { slug: "shield-+1", name: "Shield +1", bonuses: { ac: 1 }, description: "A magical shield…", entries: ["…"], rarity: "uncommon", bogus_field: "drop me" } as Record<string, unknown>;
    const out = projectToRuntime("magicitem", item);
    // description and entries are both kept now (AI consumption + legacy compat);
    // truly unknown fields like `bogus_field` are dropped.
    expect(out.bogus_field).toBeUndefined();
    expect(out.entries).toEqual(["…"]);
    expect(out.description).toBe("A magical shield…");
    expect(out.bonuses).toEqual({ ac: 1 });
    expect(out.slug).toBe("shield-+1");
    expect(out.rarity).toBe("uncommon");
  });

  it("keeps mechanical fields for spells (range, duration, components) plus description", () => {
    const spell = { slug: "fireball", name: "Fireball", description: "Long prose…", range: "150 ft", components: { v: true, s: true, m: "ball of bat guano" }, level: 3 };
    const out = projectToRuntime("spell", spell);
    expect(out.description).toBe("Long prose…");
    expect(out.range).toBe("150 ft");
    expect(out.level).toBe(3);
    expect(out.components).toBeDefined();
  });

  it("throws on unknown kind", () => {
    expect(() => projectToRuntime("aether", {})).toThrow(/unknown kind/);
  });
});

describe("to-runtime keep-list includes structured fields", () => {
  it("creature runtime entry preserves traits, actions (with attacks), reactions, legendary, damage immunities", () => {
    const canonical = {
      slug: "srd-2024_aboleth",
      name: "Aboleth",
      edition: "2024",
      source: "SRD 5.2",
      ac: [{ ac: 17, from: ["natural armor"] }],
      hp: { average: 150 },
      abilities: { str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 },
      actions: [
        {
          name: "Tail",
          attacks: [{ name: "Tail attack", type: "melee", bonus: 9, damage: "3d6+5" }],
        },
      ],
      reactions: [{ name: "Mind Lash", entries: ["Lashes back."] }],
      legendary_actions: [{ name: "Lash", entries: ["The aboleth lashes."] }],
      legendary_resistance: 3,
      traits: [{ name: "Amphibious", entries: ["Breathes air and water."] }],
      damage_immunities: ["fire"],
      condition_immunities: ["charmed"],
      damage_resistances: ["cold"],
      damage_vulnerabilities: ["radiant"],
      passive_perception: 15,
      description: "An ancient horror.",
    };
    const runtime = projectToRuntime("creature", canonical);
    expect(runtime.actions).toBeDefined();
    expect((runtime.actions as Array<{ attacks: unknown[] }>)[0].attacks).toBeDefined();
    expect(runtime.reactions).toBeDefined();
    expect(runtime.legendary_actions).toBeDefined();
    expect(runtime.legendary_resistance).toBe(3);
    expect(runtime.traits).toBeDefined();
    expect(runtime.damage_immunities).toEqual(["fire"]);
    expect(runtime.condition_immunities).toEqual(["charmed"]);
    expect(runtime.damage_resistances).toEqual(["cold"]);
    expect(runtime.damage_vulnerabilities).toEqual(["radiant"]);
    expect(runtime.passive_perception).toBe(15);
    expect(runtime.description).toBe("An ancient horror.");
  });

  it("spell runtime preserves casting_options, classes, at_higher_levels for AI consumption", () => {
    const canonical = {
      slug: "srd-5e_fireball",
      name: "Fireball",
      edition: "2014",
      source: "SRD 5.1",
      level: 3,
      school: "evocation",
      casting_time: "action",
      range: "150 feet",
      components: "V, S, M (...)",
      duration: "Instantaneous",
      casting_options: [{ type: "slot_level_4", damage_roll: "9d6" }],
      classes: ["wizard", "sorcerer"],
      at_higher_levels: ["The damage increases..."],
      description: "A bright flash of fire.",
    };
    const runtime = projectToRuntime("spell", canonical);
    expect(runtime.casting_options).toBeDefined();
    expect((runtime.casting_options as Array<{ damage_roll: string }>)[0].damage_roll).toBe("9d6");
    expect(runtime.classes).toEqual(["wizard", "sorcerer"]);
    expect(runtime.at_higher_levels).toEqual(["The damage increases..."]);
    expect(runtime.description).toBe("A bright flash of fire.");
  });

  it("item runtime preserves bonuses, attunement, base_item, attached_spells, charges, effects, type", () => {
    const canonical = {
      slug: "srd-5e_battleaxe-1",
      name: "Battleaxe (+1)",
      edition: "2014",
      source: "SRD 5.1",
      rarity: "uncommon",
      type: "weapon",
      bonuses: { attack: "+1", weapon_damage: "+1" },
      attunement: { required: false },
      base_item: "[[SRD 5e/Weapons/Battleaxe]]",
      attached_spells: { will: ["light"] },
      charges: { max: 3, recharge: "dawn" },
      effects: [{ kind: "passive" }],
      description: "A magic battleaxe.",
      // Top-level requires_attunement is not part of the runtime keep-list (I10);
      // canonical attunement lives at attunement.required.
      requires_attunement: false,
    };
    const runtime = projectToRuntime("item", canonical);
    expect(runtime.bonuses).toBeDefined();
    expect(runtime.attunement).toBeDefined();
    expect(runtime.base_item).toBe("[[SRD 5e/Weapons/Battleaxe]]");
    expect(runtime.attached_spells).toBeDefined();
    expect(runtime.charges).toBeDefined();
    expect(runtime.effects).toBeDefined();
    expect(runtime.type).toBe("weapon");
    expect(runtime.description).toBe("A magic battleaxe.");
    expect(runtime.requires_attunement).toBeUndefined();
  });

  it("class runtime preserves features_by_level, table, hit_die, proficiencies, etc.", () => {
    const canonical = {
      slug: "srd-2024_fighter",
      name: "Fighter",
      edition: "2024",
      source: "SRD 5.2",
      hit_die: "d10",
      primary_abilities: ["str"],
      saving_throws: ["str", "con"],
      proficiencies: { armor: ["light", "medium", "heavy", "shield"], weapons: { categories: ["simple", "martial"] } },
      skill_choices: { count: 2, from: ["acrobatics", "athletics"] },
      starting_equipment: [{ kind: "fixed", items: ["Longsword"] }],
      spellcasting: null,
      subclass_level: 3,
      subclass_feature_name: "Martial Archetype",
      weapon_mastery: { starting_count: 3 },
      epic_boon_level: 19,
      table: { "1": { prof_bonus: 2, feature_ids: [] } },
      features_by_level: { "1": [{ name: "Second Wind", description: "Regain HP." }] },
      resources: [],
      description: "A skilled warrior.",
    };
    const runtime = projectToRuntime("class", canonical);
    expect(runtime.hit_die).toBe("d10");
    expect(runtime.features_by_level).toBeDefined();
    expect(runtime.table).toBeDefined();
    expect(runtime.proficiencies).toBeDefined();
    expect(runtime.skill_choices).toBeDefined();
    expect(runtime.starting_equipment).toBeDefined();
    expect(runtime.subclass_level).toBe(3);
    expect(runtime.subclass_feature_name).toBe("Martial Archetype");
    expect(runtime.epic_boon_level).toBe(19);
    expect(runtime.primary_abilities).toEqual(["str"]);
    expect(runtime.saving_throws).toEqual(["str", "con"]);
    expect(runtime.description).toBe("A skilled warrior.");
  });

  it("background runtime preserves description, suggested_characteristics", () => {
    const canonical = {
      slug: "srd-5e_acolyte",
      name: "Acolyte",
      edition: "2014",
      source: "SRD 5.1",
      skill_proficiencies: ["insight"],
      tool_proficiencies: [],
      language_proficiencies: [],
      equipment: [],
      feature: { name: "Shelter of the Faithful", description: "..." },
      ability_score_increases: null,
      origin_feat: null,
      suggested_characteristics: { personality_traits: { "1": "I idolize a hero." } },
      description: "You spent your life in service of a temple.",
    };
    const runtime = projectToRuntime("background", canonical);
    expect(runtime.description).toBeDefined();
    expect(runtime.suggested_characteristics).toBeDefined();
  });

  it("race runtime preserves description and additional_spells", () => {
    const canonical = {
      slug: "srd-2024_elf",
      name: "Elf",
      edition: "2024",
      source: "SRD 5.2",
      size: "medium",
      speed: { walk: 30 },
      vision: "darkvision 60 ft.",
      traits: [],
      additional_spells: { innate: { "1": ["faerie-fire"] } },
      description: "Elves are graceful.",
    };
    const runtime = projectToRuntime("race", canonical);
    expect(runtime.description).toBe("Elves are graceful.");
    expect(runtime.additional_spells).toBeDefined();
  });

  it("feat runtime preserves description, benefits, action_cost", () => {
    const canonical = {
      slug: "srd-5e_grappler",
      name: "Grappler",
      edition: "2014",
      source: "SRD 5.1",
      description: "You've developed the skills...",
      category: "general",
      prerequisites: [],
      benefits: ["Advantage on attacks against grappled creatures."],
      repeatable: false,
      action_cost: "action",
    };
    const runtime = projectToRuntime("feat", canonical);
    expect(runtime.description).toBe("You've developed the skills...");
    expect(runtime.benefits).toBeDefined();
    expect(runtime.action_cost).toBe("action");
  });

  it("condition runtime preserves description", () => {
    const canonical = {
      slug: "srd-5e_blinded",
      name: "Blinded",
      edition: "2014",
      source: "SRD 5.1",
      description: "A blinded creature can't see.",
    };
    const runtime = projectToRuntime("condition", canonical);
    expect(runtime.description).toBe("A blinded creature can't see.");
  });

  it("optional-feature runtime preserves description, available_to", () => {
    const canonical = {
      slug: "srd-5e_agonizing-blast",
      name: "Agonizing Blast",
      edition: "2014",
      source: "SRD 5.1",
      feature_type: "invocation",
      description: "Add Cha mod to eldritch blast damage.",
      prerequisites: [],
      available_to: ["[[SRD 5e/Classes/Warlock]]"],
      effects: [],
    };
    const runtime = projectToRuntime("optional-feature", canonical);
    expect(runtime.description).toBeDefined();
    expect(runtime.available_to).toEqual(["[[SRD 5e/Classes/Warlock]]"]);
  });

  it("subclass runtime preserves description and parent_class", () => {
    const canonical = {
      slug: "srd-5e_champion",
      name: "Champion",
      edition: "2014",
      source: "SRD 5.1",
      description: "A martial archetype.",
      parent_class: "[[SRD 5e/Classes/Fighter]]",
      features_by_level: { "3": [{ name: "Improved Critical", description: "..." }] },
      resources: [],
    };
    const runtime = projectToRuntime("subclass", canonical);
    expect(runtime.description).toBe("A martial archetype.");
    expect(runtime.parent_class).toBe("[[SRD 5e/Classes/Fighter]]");
    expect(runtime.features_by_level).toBeDefined();
  });
});

describe("item keep-list — Slice 3 additions", () => {
  it("keeps description, entries, resist, immune, vulnerable, condition_immune, grants, damage, weapon_category, armor_category", () => {
    const entry = {
      name: "Test", slug: "test", description: "body",
      entries: ["legacy"], resist: ["fire"], immune: ["cold"], vulnerable: ["acid"],
      condition_immune: ["charmed"], grants: { proficiency: true },
      damage: { dice: "1d8", type: "slashing" },
      weapon_category: "martial-melee", armor_category: "heavy",
    };
    const out = projectToRuntime("item", entry);
    expect(out.description).toBe("body");
    expect(out.resist).toEqual(["fire"]);
    expect(out.immune).toEqual(["cold"]);
    expect(out.vulnerable).toEqual(["acid"]);
    expect(out.condition_immune).toEqual(["charmed"]);
    expect(out.grants).toEqual({ proficiency: true });
    expect(out.damage).toEqual({ dice: "1d8", type: "slashing" });
    expect(out.weapon_category).toBe("martial-melee");
    expect(out.armor_category).toBe("heavy");
    expect(out.entries).toEqual(["legacy"]);
  });

  it("magicitem keep-list mirrors item", () => {
    const entry = { name: "Test", slug: "test", resist: ["fire"], grants: { proficiency: true } };
    const out = projectToRuntime("magicitem", entry);
    expect(out.resist).toEqual(["fire"]);
    expect(out.grants).toEqual({ proficiency: true });
  });
});
