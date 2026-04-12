import { describe, it, expect } from "vitest";
import { normalizeSrdMonster, normalizeSrdItem, normalizeSrdSpell } from "../src/entities/srd-normalizer";

// ---------------------------------------------------------------------------
// Sample SRD monster data (Adult Red Dragon, trimmed to relevant fields)
// ---------------------------------------------------------------------------

const ADULT_RED_DRAGON_SRD: Record<string, unknown> = {
  slug: "adult-red-dragon",
  desc: "A fearsome dragon.",
  name: "Adult Red Dragon",
  size: "Huge",
  type: "Dragon",
  subtype: "",
  group: "Red Dragon",
  alignment: "chaotic evil",
  armor_class: 19,
  armor_desc: "natural armor",
  hit_points: 256,
  hit_dice: "19d12+133",
  speed: { walk: 40, fly: 80, climb: 40 },
  strength: 27,
  dexterity: 10,
  constitution: 25,
  intelligence: 16,
  wisdom: 13,
  charisma: 21,
  strength_save: null,
  dexterity_save: 6,
  constitution_save: 13,
  intelligence_save: null,
  wisdom_save: 7,
  charisma_save: 11,
  perception: 13,
  skills: { perception: 13, stealth: 6 },
  damage_vulnerabilities: "",
  damage_resistances: "",
  damage_immunities: "fire",
  condition_immunities: "",
  senses: "blindsight 60 ft., darkvision 120 ft., passive Perception 23",
  languages: "Common, Draconic",
  challenge_rating: "17",
  special_abilities: [
    {
      name: "Legendary Resistance (3/Day)",
      desc: "If the dragon fails a saving throw, it can choose to succeed instead.",
    },
  ],
  actions: [
    {
      name: "Multiattack",
      desc: "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      attack_bonus: 0,
      damage_dice: "",
      damage_bonus: 0,
    },
    {
      name: "Bite",
      desc: "Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus 7 (2d6) fire damage.",
      attack_bonus: 14,
      damage_dice: "2d10",
      damage_bonus: 8,
    },
  ],
  legendary_desc: "The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.",
  legendary_actions: [
    {
      name: "Detect",
      desc: "The dragon makes a Wisdom (Perception) check.",
    },
    {
      name: "Tail Attack",
      desc: "The dragon makes a tail attack.",
    },
  ],
  reactions: null,
  bonus_actions: null,
  page_no: 123,
  environments: ["Mountain", "Hill"],
  img_main: null,
  document__slug: "wotc-srd",
  document__title: "Systems Reference Document",
  document__license_url: "http://example.com",
  document__url: "http://example.com",
  v2_converted_path: "/v2/monsters/adult-red-dragon",
  spell_list: [],
};

// ---------------------------------------------------------------------------
// normalizeSrdMonster
// ---------------------------------------------------------------------------

describe("normalizeSrdMonster", () => {
  const result = normalizeSrdMonster(ADULT_RED_DRAGON_SRD);

  it("keeps name, size, type, alignment", () => {
    expect(result.name).toBe("Adult Red Dragon");
    expect(result.size).toBe("Huge");
    expect(result.type).toBe("Dragon");
    expect(result.alignment).toBe("chaotic evil");
  });

  it("drops empty subtype", () => {
    expect(result.subtype).toBeUndefined();
  });

  it("maps armor_class + armor_desc to ac array", () => {
    expect(result.ac).toEqual([{ ac: 19, from: ["natural armor"] }]);
  });

  it("maps hit_points + hit_dice to hp object", () => {
    expect(result.hp).toEqual({ average: 256, formula: "19d12+133" });
  });

  it("passes through speed object", () => {
    expect(result.speed).toEqual({ walk: 40, fly: 80, climb: 40 });
  });

  it("maps full ability names to abbreviations", () => {
    expect(result.abilities).toEqual({
      str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21,
    });
  });

  it("maps *_save fields, dropping nulls", () => {
    expect(result.saves).toEqual({ dex: 6, con: 13, wis: 7, cha: 11 });
  });

  it("passes through skills object", () => {
    expect(result.skills).toEqual({ perception: 13, stealth: 6 });
  });

  it("splits senses string into array and extracts passive perception", () => {
    expect(result.senses).toEqual(["blindsight 60 ft.", "darkvision 120 ft."]);
    expect(result.passive_perception).toBe(23);
  });

  it("splits languages string into array", () => {
    expect(result.languages).toEqual(["Common", "Draconic"]);
  });

  it("maps challenge_rating to cr", () => {
    expect(result.cr).toBe("17");
  });

  it("converts damage_immunities string to array", () => {
    expect(result.damage_immunities).toEqual(["fire"]);
  });

  it("drops empty damage/condition strings", () => {
    expect(result.damage_vulnerabilities).toBeUndefined();
    expect(result.damage_resistances).toBeUndefined();
    expect(result.condition_immunities).toBeUndefined();
  });

  it("maps special_abilities to traits with entries array", () => {
    expect(result.traits).toEqual([
      {
        name: "Legendary Resistance (3/Day)",
        entries: ["If the dragon fails a saving throw, it can choose to succeed instead."],
      },
    ]);
  });

  it("converts Bite action mechanics to formula tags", () => {
    const actions = result.actions as { name: string; entries: string[] }[];
    expect(actions).toHaveLength(2);
    // Multiattack — pure prose, no patterns to convert
    expect(actions[0].name).toBe("Multiattack");
    expect(actions[0].entries).toHaveLength(1);
    // Bite — attack bonus and damage expressions become formula tags
    const bite = actions.find((a) => a.name === "Bite");
    expect(bite).toBeDefined();
    const entry = bite!.entries[0];
    expect(entry).toContain("`atk:STR`");
    expect(entry).toContain("`damage:2d10+STR`");
    expect(entry).toContain("`damage:2d6`");
    // Preserves surrounding prose
    expect(entry).toContain("Melee Weapon Attack:");
    expect(entry).toContain("piercing damage");
    expect(entry).toContain("fire damage");
  });

  it("maps legendary_actions to legendary with entries array", () => {
    expect(result.legendary).toEqual([
      { name: "Detect", entries: ["The dragon makes a Wisdom (Perception) check."] },
      { name: "Tail Attack", entries: ["The dragon makes a tail attack."] },
    ]);
  });

  it("extracts legendary_actions count from legendary_desc", () => {
    expect(result.legendary_actions).toBe(3);
  });

  it("handles null reactions and bonus_actions", () => {
    expect(result.reactions).toBeUndefined();
    expect(result.bonus_actions).toBeUndefined();
  });

  it("drops metadata fields", () => {
    expect(result.slug).toBeUndefined();
    expect(result.desc).toBeUndefined();
    expect(result.group).toBeUndefined();
    expect(result.page_no).toBeUndefined();
    expect(result.environments).toBeUndefined();
    expect(result.document__slug).toBeUndefined();
    expect(result.v2_converted_path).toBeUndefined();
    expect(result.spell_list).toBeUndefined();
  });
});

describe("normalizeSrdMonster edge cases", () => {
  it("handles minimal monster with just a name", () => {
    const result = normalizeSrdMonster({ name: "Unknown Beast" });
    expect(result.name).toBe("Unknown Beast");
    expect(result.ac).toBeUndefined();
    expect(result.hp).toBeUndefined();
    expect(result.abilities).toBeUndefined();
  });

  it("handles AC without armor_desc", () => {
    const result = normalizeSrdMonster({ name: "Test", armor_class: 12, armor_desc: null });
    expect(result.ac).toEqual([{ ac: 12 }]);
  });

  it("handles empty armor_desc string", () => {
    const result = normalizeSrdMonster({ name: "Test", armor_class: 10, armor_desc: "" });
    expect(result.ac).toEqual([{ ac: 10 }]);
  });

  it("handles senses without passive perception", () => {
    const result = normalizeSrdMonster({ name: "Test", senses: "blindsight 30 ft. (blind beyond this radius)" });
    expect(result.senses).toEqual(["blindsight 30 ft. (blind beyond this radius)"]);
    expect(result.passive_perception).toBeUndefined();
  });

  it("handles senses that is only passive perception", () => {
    const result = normalizeSrdMonster({ name: "Test", senses: "passive Perception 10" });
    expect(result.senses).toBeUndefined();
    expect(result.passive_perception).toBe(10);
  });

  it("handles cr field directly", () => {
    const result = normalizeSrdMonster({ name: "Test", cr: 5 });
    expect(result.cr).toBe("5");
  });

  it("prefers challenge_rating over cr", () => {
    const result = normalizeSrdMonster({ name: "Test", challenge_rating: "1/2", cr: 99 });
    expect(result.cr).toBe("1/2");
  });

  it("handles multiple damage types in comma-separated string", () => {
    const result = normalizeSrdMonster({ name: "Test", damage_resistances: "cold, fire, lightning" });
    expect(result.damage_resistances).toEqual(["cold", "fire", "lightning"]);
  });

  it("handles damage fields that are already arrays", () => {
    const result = normalizeSrdMonster({ name: "Test", damage_immunities: ["fire", "cold"] });
    expect(result.damage_immunities).toEqual(["fire", "cold"]);
  });

  it("handles empty senses and languages strings", () => {
    const result = normalizeSrdMonster({ name: "Test", senses: "", languages: "" });
    expect(result.senses).toBeUndefined();
    expect(result.languages).toBeUndefined();
  });

  it("normalized output round-trips through monster parser", async () => {
    const { parseMonster } = await import("../src/parsers/monster-parser");
    const yaml = await import("js-yaml");
    const normalized = normalizeSrdMonster(ADULT_RED_DRAGON_SRD);
    const yamlStr = yaml.dump(normalized, { lineWidth: -1, noRefs: true });
    const parsed = parseMonster(yamlStr);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Adult Red Dragon");
      expect(parsed.data.ac?.[0].ac).toBe(19);
      expect(parsed.data.ac?.[0].from).toEqual(["natural armor"]);
      expect(parsed.data.hp?.average).toBe(256);
      expect(parsed.data.hp?.formula).toBe("19d12+133");
      expect(parsed.data.abilities?.str).toBe(27);
      expect(parsed.data.saves?.dex).toBe(6);
      expect(parsed.data.cr).toBe("17");
      expect(parsed.data.traits).toHaveLength(1);
      expect(parsed.data.actions).toHaveLength(2);
      expect(parsed.data.legendary).toHaveLength(2);
      expect(parsed.data.legendary_actions).toBe(3);
      expect(parsed.data.senses).toEqual(["blindsight 60 ft.", "darkvision 120 ft."]);
      expect(parsed.data.passive_perception).toBe(23);
      expect(parsed.data.damage_immunities).toEqual(["fire"]);
    }
  });
});

// ---------------------------------------------------------------------------
// normalizeSrdItem
// ---------------------------------------------------------------------------

describe("normalizeSrdItem", () => {
  it("maps desc to entries split by double newline", () => {
    const raw = {
      name: "Bag of Holding",
      type: "Wondrous item",
      rarity: "uncommon",
      desc: "This bag has an interior space.\n\nPlacing the bag inside another extradimensional space instantly destroys both.",
      requires_attunement: "",
    };
    const result = normalizeSrdItem(raw);
    expect(result.entries).toEqual([
      "This bag has an interior space.",
      "Placing the bag inside another extradimensional space instantly destroys both.",
    ]);
    expect(result.desc).toBeUndefined();
  });

  it("maps requires_attunement 'requires attunement' to true", () => {
    const raw = {
      name: "Cloak of Protection",
      type: "Wondrous item",
      rarity: "uncommon",
      desc: "You gain a +1 bonus to AC and saving throws.",
      requires_attunement: "requires attunement",
    };
    const result = normalizeSrdItem(raw);
    expect(result.attunement).toBe(true);
    expect(result.requires_attunement).toBeUndefined();
  });

  it("maps empty requires_attunement to false", () => {
    const raw = {
      name: "Bag of Holding",
      type: "Wondrous item",
      rarity: "uncommon",
      desc: "A bag.",
      requires_attunement: "",
    };
    const result = normalizeSrdItem(raw);
    expect(result.attunement).toBe(false);
  });

  it("strips 'requires attunement' prefix to extract class requirement", () => {
    const raw = {
      name: "Holy Avenger",
      type: "Weapon (any sword)",
      rarity: "legendary",
      desc: "A powerful sword.",
      requires_attunement: "requires attunement by a paladin",
    };
    const result = normalizeSrdItem(raw);
    expect(result.attunement).toBe("by a paladin");
  });

  it("preserves name, type, and rarity", () => {
    const raw = {
      name: "Amulet of the Planes",
      type: "Wondrous item",
      rarity: "very rare",
      desc: "While wearing this amulet, you can use an action to name a location.",
      requires_attunement: "requires attunement",
    };
    const result = normalizeSrdItem(raw);
    expect(result.name).toBe("Amulet of the Planes");
    expect(result.type).toBe("Wondrous item");
    expect(result.rarity).toBe("very rare");
  });

  it("drops slug and document__ metadata fields", () => {
    const raw = {
      name: "Test Item",
      slug: "test-item",
      desc: "A test item.",
      document__slug: "srd",
      document__title: "SRD",
      document__license_url: "http://example.com",
      document__url: "http://example.com",
      requires_attunement: "",
    };
    const result = normalizeSrdItem(raw);
    expect(result.slug).toBeUndefined();
    expect(result.document__slug).toBeUndefined();
    expect(result.document__title).toBeUndefined();
    expect(result.document__license_url).toBeUndefined();
    expect(result.document__url).toBeUndefined();
  });

  it("handles missing requires_attunement field", () => {
    const raw = {
      name: "Potion of Healing",
      type: "Potion",
      rarity: "common",
      desc: "Regain 2d4 + 2 hit points.",
    };
    const result = normalizeSrdItem(raw);
    // No attunement key added when the field is absent
    expect(result.attunement).toBeUndefined();
  });

  it("handles single-paragraph desc", () => {
    const raw = {
      name: "Potion of Healing",
      type: "Potion",
      rarity: "common",
      desc: "You regain 2d4 + 2 hit points when you drink this potion.",
      requires_attunement: "",
    };
    const result = normalizeSrdItem(raw);
    expect(result.entries).toEqual([
      "You regain 2d4 + 2 hit points when you drink this potion.",
    ]);
  });

  it("filters empty paragraphs from desc", () => {
    const raw = {
      name: "Test Item",
      desc: "First paragraph.\n\n\n\nSecond paragraph.",
      requires_attunement: "",
    };
    const result = normalizeSrdItem(raw);
    expect(result.entries).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ]);
  });

  it("handles boolean requires_attunement passthrough", () => {
    const raw = {
      name: "Test Item",
      desc: "A test.",
      requires_attunement: true,
    };
    const result = normalizeSrdItem(raw);
    expect(result.attunement).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeSrdSpell
// ---------------------------------------------------------------------------

describe("normalizeSrdSpell", () => {
  const FULL_SRD_SPELL: Record<string, unknown> = {
    slug: "fireball",
    name: "Fireball",
    spell_level: 3,
    school: "Evocation",
    casting_time: "1 action",
    range: "150 feet",
    components: "V, S, M (a tiny ball of bat guano and sulfur)",
    duration: "Instantaneous",
    concentration: "no",
    ritual: "no",
    dnd_class: "Sorcerer, Wizard",
    desc: "A bright streak flashes from your pointing finger.\n\nEach creature in a 20-foot-radius sphere must make a Dexterity saving throw.",
    higher_level: "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
    page: "srd",
    document__slug: "srd",
    document__title: "SRD",
    document__license_url: "http://example.com",
    document__url: "http://example.com",
    requires_verbal_components: true,
    requires_somatic_components: true,
    requires_material_components: true,
    material: "a tiny ball of bat guano and sulfur",
    archetype: "",
    circles: "",
    target_range_sort: 15000,
  };

  it("maps spell_level to level", () => {
    const result = normalizeSrdSpell(FULL_SRD_SPELL);
    expect(result.level).toBe(3);
  });

  it("maps level_int to level when spell_level is absent", () => {
    const raw = { name: "Test", level_int: 2 };
    const result = normalizeSrdSpell(raw);
    expect(result.level).toBe(2);
  });

  it("passes through level if already present", () => {
    const raw = { name: "Test", level: 5 };
    const result = normalizeSrdSpell(raw);
    expect(result.level).toBe(5);
  });

  it("maps desc string to description array split by double newline", () => {
    const result = normalizeSrdSpell(FULL_SRD_SPELL);
    expect(result.description).toEqual([
      "A bright streak flashes from your pointing finger.",
      "Each creature in a 20-foot-radius sphere must make a Dexterity saving throw.",
    ]);
  });

  it("passes through description array if already present", () => {
    const raw = { name: "Test", description: ["paragraph 1", "paragraph 2"] };
    const result = normalizeSrdSpell(raw);
    expect(result.description).toEqual(["paragraph 1", "paragraph 2"]);
  });

  it("maps higher_level string to at_higher_levels array", () => {
    const result = normalizeSrdSpell(FULL_SRD_SPELL);
    expect(result.at_higher_levels).toEqual([
      "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
    ]);
  });

  it("filters empty higher_level string", () => {
    const raw = { name: "Test", higher_level: "" };
    const result = normalizeSrdSpell(raw);
    expect(result.at_higher_levels).toBeUndefined();
  });

  it("maps concentration 'yes' to true", () => {
    const raw = { name: "Test", concentration: "yes" };
    const result = normalizeSrdSpell(raw);
    expect(result.concentration).toBe(true);
  });

  it("maps concentration 'no' to false", () => {
    const raw = { name: "Test", concentration: "no" };
    const result = normalizeSrdSpell(raw);
    expect(result.concentration).toBe(false);
  });

  it("maps requires_concentration boolean", () => {
    const raw = { name: "Test", requires_concentration: true };
    const result = normalizeSrdSpell(raw);
    expect(result.concentration).toBe(true);
  });

  it("prefers requires_concentration over concentration string", () => {
    const raw = { name: "Test", requires_concentration: false, concentration: "yes" };
    const result = normalizeSrdSpell(raw);
    expect(result.concentration).toBe(false);
  });

  it("maps ritual 'yes' to true", () => {
    const raw = { name: "Test", ritual: "yes" };
    const result = normalizeSrdSpell(raw);
    expect(result.ritual).toBe(true);
  });

  it("maps ritual 'no' to false", () => {
    const raw = { name: "Test", ritual: "no" };
    const result = normalizeSrdSpell(raw);
    expect(result.ritual).toBe(false);
  });

  it("maps can_be_cast_as_ritual boolean", () => {
    const raw = { name: "Test", can_be_cast_as_ritual: true };
    const result = normalizeSrdSpell(raw);
    expect(result.ritual).toBe(true);
  });

  it("maps dnd_class comma string to classes array", () => {
    const result = normalizeSrdSpell(FULL_SRD_SPELL);
    expect(result.classes).toEqual(["Sorcerer", "Wizard"]);
  });

  it("capitalizes class names from dnd_class", () => {
    const raw = { name: "Test", dnd_class: "sorcerer, wizard, bard" };
    const result = normalizeSrdSpell(raw);
    expect(result.classes).toEqual(["Sorcerer", "Wizard", "Bard"]);
  });

  it("maps spell_lists array to classes with capitalization", () => {
    const raw = { name: "Test", spell_lists: ["sorcerer", "wizard"] };
    const result = normalizeSrdSpell(raw);
    expect(result.classes).toEqual(["Sorcerer", "Wizard"]);
  });

  it("prefers spell_lists over dnd_class", () => {
    const raw = { name: "Test", spell_lists: ["cleric"], dnd_class: "Sorcerer, Wizard" };
    const result = normalizeSrdSpell(raw);
    expect(result.classes).toEqual(["Cleric"]);
  });

  it("passes through classes array if already present", () => {
    const raw = { name: "Test", classes: ["Sorcerer", "Wizard"] };
    const result = normalizeSrdSpell(raw);
    expect(result.classes).toEqual(["Sorcerer", "Wizard"]);
  });

  it("preserves pass-through fields", () => {
    const result = normalizeSrdSpell(FULL_SRD_SPELL);
    expect(result.name).toBe("Fireball");
    expect(result.school).toBe("Evocation");
    expect(result.casting_time).toBe("1 action");
    expect(result.range).toBe("150 feet");
    expect(result.components).toBe("V, S, M (a tiny ball of bat guano and sulfur)");
    expect(result.duration).toBe("Instantaneous");
  });

  it("drops SRD metadata fields", () => {
    const result = normalizeSrdSpell(FULL_SRD_SPELL);
    expect(result.slug).toBeUndefined();
    expect(result.page).toBeUndefined();
    expect(result.document__slug).toBeUndefined();
    expect(result.document__title).toBeUndefined();
    expect(result.requires_verbal_components).toBeUndefined();
    expect(result.requires_somatic_components).toBeUndefined();
    expect(result.requires_material_components).toBeUndefined();
    expect(result.material).toBeUndefined();
    expect(result.archetype).toBeUndefined();
    expect(result.circles).toBeUndefined();
    expect(result.target_range_sort).toBeUndefined();
  });

  it("handles cantrip (level 0)", () => {
    const raw = { name: "Fire Bolt", spell_level: 0, school: "Evocation" };
    const result = normalizeSrdSpell(raw);
    expect(result.level).toBe(0);
  });

  it("handles minimal spell (name only)", () => {
    const raw = { name: "Unknown Spell" };
    const result = normalizeSrdSpell(raw);
    expect(result.name).toBe("Unknown Spell");
    expect(result.level).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.classes).toBeUndefined();
    expect(result.concentration).toBeUndefined();
    expect(result.ritual).toBeUndefined();
  });

  it("handles multi-paragraph higher_level", () => {
    const raw = {
      name: "Test",
      higher_level: "When cast at 4th level, damage increases.\n\nWhen cast at 5th level, range doubles.",
    };
    const result = normalizeSrdSpell(raw);
    expect(result.at_higher_levels).toEqual([
      "When cast at 4th level, damage increases.",
      "When cast at 5th level, range doubles.",
    ]);
  });

  it("filters empty paragraphs from desc", () => {
    const raw = {
      name: "Test",
      desc: "First paragraph.\n\n\n\nSecond paragraph.",
    };
    const result = normalizeSrdSpell(raw);
    expect(result.description).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ]);
  });

  it("handles empty dnd_class string", () => {
    const raw = { name: "Test", dnd_class: "" };
    const result = normalizeSrdSpell(raw);
    expect(result.classes).toBeUndefined();
  });

  it("handles empty spell_lists array", () => {
    const raw = { name: "Test", spell_lists: [] };
    const result = normalizeSrdSpell(raw);
    expect(result.classes).toBeUndefined();
  });
});
