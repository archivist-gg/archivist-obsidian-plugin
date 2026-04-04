import { describe, it, expect } from "vitest";
import { normalizeSrdItem, normalizeSrdSpell } from "../src/entities/srd-normalizer";

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
