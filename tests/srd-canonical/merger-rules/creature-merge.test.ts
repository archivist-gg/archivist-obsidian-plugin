import { describe, it, expect } from "vitest";
import { toCreatureCanonical } from "../../../tools/srd-canonical/merger-rules/creature-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

// Aboleth shape, modeled on real Open5e v2 (2024) data — primary damage in
// damage_*; the SRD 2024 cache often puts primary in extra_damage_* but for
// readability the canonical attack-shape test uses the plan's clean primary form.
const aboleth2024: Record<string, unknown> = {
  key: "srd_aboleth",
  name: "Aboleth",
  document: { name: "SRD 5.2", key: "srd-2024" },
  size: { name: "Large", key: "large" },
  type: { name: "Aberration", key: "aberration" },
  alignment: "lawful evil",
  armor_class: 17,
  armor_detail: "natural armor",
  hit_points: 150,
  hit_dice: "20d10+40",
  challenge_rating: 10,
  passive_perception: 20,
  ability_scores: { strength: 21, dexterity: 9, constitution: 15, intelligence: 18, wisdom: 15, charisma: 18 },
  modifiers: { strength: 5, dexterity: -1, constitution: 2, intelligence: 4, wisdom: 2, charisma: 4 },
  saving_throws: { constitution: 6, intelligence: 8, wisdom: 6 },
  skill_bonuses: { history: 12, perception: 10 },
  speed: { walk: 10, swim: 40, fly: 0, climb: 0, burrow: 0, unit: "feet" },
  darkvision_range: 120,
  blindsight_range: null,
  truesight_range: null,
  tremorsense_range: null,
  normal_sight_range: 20,
  languages: { as_string: "Deep Speech, telepathy 120 ft.", data: [] },
  resistances_and_immunities: {
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
  },
  actions: [
    {
      name: "Tail",
      desc: "Melee Weapon Attack: +9 to hit, reach 10 ft.",
      action_type: "ACTION",
      legendary_action_cost: 0,
      attacks: [{
        name: "Tail attack",
        attack_type: "WEAPON",
        to_hit_mod: 9,
        reach: 10,
        range: null,
        long_range: null,
        target_creature_only: false,
        damage_die_count: 3,
        damage_die_type: "D6",
        damage_bonus: 5,
        damage_type: { name: "Bludgeoning", key: "bludgeoning" },
        extra_damage_die_count: null,
        extra_damage_die_type: null,
        extra_damage_bonus: null,
        extra_damage_type: null,
        distance_unit: "feet",
      }],
    },
    {
      name: "Some Reaction",
      desc: "...",
      action_type: "REACTION",
      legendary_action_cost: 0,
      attacks: [],
    },
    {
      name: "Tail Swipe",
      desc: "The aboleth makes one tail attack.",
      action_type: "LEGENDARY_ACTION",
      legendary_action_cost: 1,
      attacks: [],
    },
  ],
  traits: [
    { name: "Amphibious", desc: "The aboleth can breathe air and water." },
    { name: "Legendary Resistance (3/Day)", desc: "If the aboleth fails a save, it can choose to succeed instead." },
  ],
  subcategory: null,
};

function buildEntry(base: Record<string, unknown>, edition: "2014" | "2024" = "2024"): CanonicalEntry {
  return {
    slug: `srd-${edition}_${(base.name as string).toLowerCase().replace(/\s+/g, "-")}`,
    edition,
    kind: "creature",
    base: base as never,
    structured: null,
    activation: null,
    overlay: null,
  };
}

describe("creature-merge field paths and structured attacks (β+)", () => {
  it("reads armor_class + armor_detail to ac:[{ac, from}]", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.ac).toEqual([{ ac: 17, from: ["natural armor"] }]);
  });

  it("reads hit_points + hit_dice", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.hp).toEqual({ average: 150, formula: "20d10+40" });
  });

  it("reads ability_scores with full names → short keys", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.abilities).toEqual({ str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 });
  });

  it("reads challenge_rating to cr (string)", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.cr).toBe("10");
  });

  it("composes senses string array from numeric range fields (spatial senses only)", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.senses).toContain("darkvision 120 ft.");
  });

  it("excludes passive Perception from senses array (top-level field is the source of truth)", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.senses).not.toContain(expect.stringMatching(/passive perception/i));
    expect(result.passive_perception).toBe(20);
  });

  it("normalizes size/type from object {name,key} to string", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(typeof result.size).toBe("string");
    expect(result.size.toLowerCase()).toBe("large");
    expect(typeof result.type).toBe("string");
    expect(result.type.toLowerCase()).toBe("aberration");
  });

  it("speed only emits modes with value > 0", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.speed.walk).toBe(10);
    expect(result.speed.swim).toBe(40);
    expect(result.speed.fly).toBeUndefined();
    expect(result.speed.climb).toBeUndefined();
    expect(result.speed.burrow).toBeUndefined();
  });

  it("languages.as_string parsed to string array", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(Array.isArray(result.languages)).toBe(true);
    expect(result.languages).toContain("Deep Speech");
    expect(result.languages).toContain("telepathy 120 ft.");
  });

  it("saves uses short ability keys", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.saves).toEqual({ con: 6, int: 8, wis: 6 });
  });

  it("splits actions[] by action_type into actions/reactions/legendary buckets", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.actions!.find(a => a.name === "Tail")).toBeDefined();
    expect(result.actions!.find(a => a.name === "Some Reaction")).toBeUndefined();
    expect(result.reactions!.find(a => a.name === "Some Reaction")).toBeDefined();
    expect(result.legendary_actions!.find(a => a.name === "Tail Swipe")).toBeDefined();
  });

  it("emits structured Feature.attacks for actions with attacks[]", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    const tail = result.actions!.find(a => a.name === "Tail")!;
    expect(tail.attacks).toBeDefined();
    expect(tail.attacks!.length).toBe(1);
    expect(tail.attacks![0].bonus).toBe(9);
    expect(tail.attacks![0].damage).toBe("3d6+5");
    expect(tail.attacks![0].damage_type).toBe("bludgeoning");
    expect(tail.attacks![0].range).toEqual({ reach: 10 });
    expect(tail.attacks![0].type).toBe("melee");
  });

  it("extracts Legendary Resistance (N/Day) numeric count AND keeps the trait in traits[]", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024));
    expect(result.legendary_resistance).toBe(3);
    // The trait is preserved (with its prose) so it renders in the TRAITS tab
    // alongside other special traits; the numeric field is additive.
    const lrTrait = result.traits!.find(t => /Legendary Resistance/i.test(t.name));
    expect(lrTrait).toBeDefined();
    expect(lrTrait!.entries?.[0]).toContain("succeed instead");
    expect(result.traits!.find(t => t.name === "Amphibious")).toBeDefined();
  });

  it("preserves 2024 'Legendary Resistance (3/Day, or 4/Day in Lair)' trait with full prose", () => {
    const baseDragon: Record<string, unknown> = {
      ...aboleth2024,
      name: "Adult Black Dragon",
      traits: [
        {
          name: "Legendary Resistance (3/Day, or 4/Day in Lair)",
          desc: "If the dragon fails a saving throw, it can choose to succeed instead.",
        },
        { name: "Amphibious", desc: "The dragon can breathe air and water." },
      ],
    };
    const result = toCreatureCanonical(buildEntry(baseDragon, "2024"));
    const traitNames = result.traits!.map(t => t.name);
    expect(traitNames).toContain("Legendary Resistance (3/Day, or 4/Day in Lair)");
    expect(traitNames).toContain("Amphibious");
    expect(result.legendary_resistance).toBe(3); // numeric still extracted
    const lrTrait = result.traits!.find(t => t.name.startsWith("Legendary Resistance"));
    expect(lrTrait?.entries?.[0]).toContain("succeed instead"); // prose preserved
  });

  it("emits resistance/immunity/condition arrays as flat string keys", () => {
    const base = {
      ...aboleth2024,
      resistances_and_immunities: {
        damage_immunities: [{ key: "psychic", name: "Psychic" }],
        damage_resistances: [{ key: "fire", name: "Fire" }],
        damage_vulnerabilities: [{ key: "thunder", name: "Thunder" }],
        condition_immunities: [{ key: "charmed", name: "Charmed" }],
      },
    };
    const result = toCreatureCanonical(buildEntry(base));
    expect(result.damage_immunities).toEqual(["psychic"]);
    expect(result.damage_resistances).toEqual(["fire"]);
    expect(result.damage_vulnerabilities).toEqual(["thunder"]);
    expect(result.condition_immunities).toEqual(["charmed"]);
  });

  it("source is SRD 5.2 for 2024 edition", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024, "2024"));
    expect(result.source).toBe("SRD 5.2");
  });

  it("source is SRD 5.1 for 2014 edition", () => {
    const result = toCreatureCanonical(buildEntry(aboleth2024, "2014"));
    expect(result.source).toBe("SRD 5.1");
  });
});

describe("creature-merge edition-aware damage location", () => {
  // 2024 layout: primary damage carried in extra_damage_*, damage_* is null.
  const tentacle2024: Record<string, unknown> = {
    ...aboleth2024,
    name: "Aboleth-2024",
    actions: [
      {
        name: "Tentacle",
        desc: "Melee Attack Roll: +9, reach 15 ft.",
        action_type: "ACTION",
        legendary_action_cost: 0,
        attacks: [{
          name: "Tentacle attack",
          attack_type: "WEAPON",
          to_hit_mod: 9,
          reach: 15,
          range: null,
          long_range: null,
          target_creature_only: false,
          damage_die_count: 2,
          damage_die_type: "D6",
          damage_bonus: 5,
          damage_type: null,
          extra_damage_die_count: null,
          extra_damage_die_type: null,
          extra_damage_bonus: null,
          extra_damage_type: { name: "Bludgeoning", key: "bludgeoning" },
          distance_unit: "feet",
        }],
      },
    ],
  };

  it("2024-style: extra_damage_type populated, damage_type null → uses extra_* for primary type", () => {
    const result = toCreatureCanonical(buildEntry(tentacle2024));
    const tentacle = result.actions!.find(a => a.name === "Tentacle")!;
    expect(tentacle.attacks![0].damage_type).toBe("bludgeoning");
    expect(tentacle.attacks![0].damage).toBe("2d6+5");
    expect(tentacle.attacks![0].extra_damage).toBeUndefined();
  });

  // Both populated: damage_* primary, extra_* becomes extra_damage.
  const dragonBite: Record<string, unknown> = {
    ...aboleth2024,
    name: "Bite-Both",
    actions: [
      {
        name: "Rend",
        desc: "Bite",
        action_type: "ACTION",
        legendary_action_cost: 0,
        attacks: [{
          name: "Rend attack",
          attack_type: "WEAPON",
          to_hit_mod: 11,
          reach: 10,
          range: null,
          long_range: null,
          damage_die_count: 2,
          damage_die_type: "D6",
          damage_bonus: 6,
          damage_type: { name: "Slashing", key: "slashing" },
          extra_damage_die_count: 1,
          extra_damage_die_type: "D8",
          extra_damage_bonus: 0,
          extra_damage_type: { name: "Acid", key: "acid" },
          distance_unit: "feet",
        }],
      },
    ],
  };

  it("both primary+extra populated: damage_* is primary, extra_* becomes extra_damage", () => {
    const result = toCreatureCanonical(buildEntry(dragonBite));
    const rend = result.actions!.find(a => a.name === "Rend")!;
    expect(rend.attacks![0].damage).toBe("2d6+6");
    expect(rend.attacks![0].damage_type).toBe("slashing");
    expect(rend.attacks![0].extra_damage).toEqual({ dice: "1d8", type: "acid" });
  });

  // Ranged attack (no reach, has range/long_range)
  const arrow: Record<string, unknown> = {
    ...aboleth2024,
    name: "Archer",
    actions: [
      {
        name: "Longbow",
        desc: "Ranged",
        action_type: "ACTION",
        legendary_action_cost: 0,
        attacks: [{
          name: "Longbow attack",
          attack_type: "WEAPON",
          to_hit_mod: 5,
          reach: null,
          range: 150,
          long_range: 600,
          damage_die_count: 1,
          damage_die_type: "D8",
          damage_bonus: 3,
          damage_type: { name: "Piercing", key: "piercing" },
          extra_damage_die_count: null,
          extra_damage_die_type: null,
          extra_damage_bonus: null,
          extra_damage_type: null,
          distance_unit: "feet",
        }],
      },
    ],
  };

  it("ranged attack: type=ranged with range.normal/long", () => {
    const result = toCreatureCanonical(buildEntry(arrow));
    const longbow = result.actions!.find(a => a.name === "Longbow")!;
    expect(longbow.attacks![0].type).toBe("ranged");
    expect(longbow.attacks![0].range).toEqual({ normal: 150, long: 600 });
  });
});
