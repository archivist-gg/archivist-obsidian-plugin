import { describe, it, expect } from "vitest";
import { toSpellCanonical } from "../../../tools/srd-canonical/merger-rules/spell-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("spellMergeRule", () => {
  it("produces canonical Spell for Fireball (basic damage spell)", () => {
    const canonical: CanonicalEntry = {
      slug: "fireball",
      edition: "2014",
      kind: "spell",
      base: {
        key: "fireball",
        name: "Fireball",
        document: { key: "srd-2014", name: "SRD 5.1" },
        level: 3,
        school: { name: "Evocation", key: "evocation" },
        casting_time: "1 action",
        range: 150,
        range_text: "150 feet",
        verbal: true,
        somatic: true,
        material: true,
        material_specified: "a tiny ball of bat guano and sulfur",
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        desc: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.",
      },
      structured: {
        name: "Fireball",
        source: "PHB",
        damageInflict: ["fire"],
        savingThrow: ["dexterity"],
        entriesHigherLevel: [
          {
            type: "entries",
            name: "At Higher Levels",
            entries: ["When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd."],
          },
        ],
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toSpellCanonical(canonical);
    expect(out.slug).toBe("fireball");
    expect(out.name).toBe("Fireball");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.level).toBe(3);
    expect(out.school).toBe("evocation");
    expect(out.casting_time).toBe("1 action");
    expect(out.range).toBe("150 feet");
    expect(out.components).toContain("V, S, M");
    expect(out.duration).toBe("Instantaneous");
    expect(out.concentration).toBe(false);
    expect(out.ritual).toBe(false);
    expect(out.description).toContain("bright streak");
    expect(out.damage?.types).toEqual(["fire"]);
    expect(out.saving_throw?.ability).toBe("dexterity");
    expect(out.at_higher_levels?.[0]).toContain("4th level or higher");
  });

  it("produces canonical Spell for Wish (high-level, no damage, complex)", () => {
    const canonical: CanonicalEntry = {
      slug: "wish",
      edition: "2014",
      kind: "spell",
      base: {
        key: "wish",
        name: "Wish",
        document: { key: "srd-2014", name: "SRD 5.1" },
        level: 9,
        school: { name: "Conjuration", key: "conjuration" },
        casting_time: "1 action",
        range: 0,
        range_text: "Self",
        verbal: true,
        somatic: false,
        material: false,
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        desc: "Wish is the mightiest spell a mortal creature can cast.",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSpellCanonical(canonical);
    expect(out.level).toBe(9);
    expect(out.school).toBe("conjuration");
    expect(out.range).toBe("Self");
    expect(out.damage).toBeUndefined();
    expect(out.saving_throw).toBeUndefined();
    expect(out.at_higher_levels).toBeUndefined();
    expect(out.description).toContain("mightiest spell");
  });

  it("produces canonical Spell for Dispel Magic (pass-through Open5e basic shape)", () => {
    const canonical: CanonicalEntry = {
      slug: "dispel-magic",
      edition: "2014",
      kind: "spell",
      base: {
        key: "dispel-magic",
        name: "Dispel Magic",
        document: { key: "srd-2014", name: "SRD 5.1" },
        level: 3,
        school: { name: "Abjuration", key: "abjuration" },
        casting_time: "1 action",
        range: 120,
        range_text: "120 feet",
        verbal: true,
        somatic: true,
        material: false,
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        desc: "Choose any creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends.",
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toSpellCanonical(canonical);
    expect(out.slug).toBe("dispel-magic");
    expect(out.level).toBe(3);
    expect(out.school).toBe("abjuration");
    expect(out.concentration).toBe(false);
    expect(out.ritual).toBe(false);
    expect(out.description).toContain("Choose any creature");
  });
});

describe("spell-merge shape correctness (Open5e v2 normalization)", () => {
  const baseEntry = (base: Record<string, unknown>): CanonicalEntry => ({
    slug: "srd-5e_fireball",
    edition: "2014",
    kind: "spell",
    base,
    structured: null,
    activation: null,
    overlay: null,
  });

  it("normalizes school object to lowercase string", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 150,
      range_text: "150 feet",
      verbal: true, somatic: true, material: true,
      material_specified: "tiny ball of bat guano",
      duration: "Instantaneous",
      concentration: false, ritual: false,
    }));
    expect(result.school).toBe("evocation");
  });

  it("uses range_text for the parser-compatible range string", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      range: 150,
      range_text: "150 feet",
      casting_time: "action",
      verbal: true, somatic: true, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
    }));
    expect(result.range).toBe("150 feet");
  });

  it("composes components from booleans + material_specified", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 150, range_text: "150 feet",
      verbal: true, somatic: true, material: true,
      material_specified: "tiny ball of bat guano and sulfur",
      duration: "Instantaneous",
      concentration: false, ritual: false,
    }));
    expect(result.components).toBe("V, S, M (tiny ball of bat guano and sulfur)");
  });

  it("falls back to `${range} feet` if range_text missing", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Foo",
      level: 1,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 60,
      verbal: true, somatic: false, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
    }));
    expect(result.range).toBe("60 feet");
  });

  it("composes components without material_specified as plain M", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Foo",
      level: 1,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 60, range_text: "60 feet",
      verbal: true, somatic: true, material: true,
      duration: "Instantaneous",
      concentration: false, ritual: false,
    }));
    expect(result.components).toBe("V, S, M");
  });

  it("surfaces classes (lowercased name) from Open5e v2 class objects", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 150, range_text: "150 feet",
      verbal: true, somatic: true, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
      classes: [
        { name: "Sorcerer", key: "srd_sorcerer" },
        { name: "Wizard", key: "srd_wizard" },
      ],
    }));
    expect(result.classes).toEqual(["sorcerer", "wizard"]);
  });

  it("surfaces at_higher_levels as string[] from base.higher_level", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 150, range_text: "150 feet",
      verbal: true, somatic: true, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
      higher_level: "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
    }));
    expect(Array.isArray(result.at_higher_levels)).toBe(true);
    expect(result.at_higher_levels?.[0]).toContain("4th level or higher");
  });

  it("surfaces damage and saving_throw from Open5e v2 fields", () => {
    const result = toSpellCanonical(baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 150, range_text: "150 feet",
      verbal: true, somatic: true, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
      damage_types: ["fire"],
      saving_throw_ability: "dexterity",
    }));
    expect(result.damage?.types).toEqual(["fire"]);
    expect(result.saving_throw?.ability).toBe("dexterity");
  });

  it("emits casting_options[] from Open5e source, folding 2014 default row into top-level", () => {
    const entry = baseEntry({
      name: "Fireball",
      level: 3,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 150, range_text: "150 feet",
      verbal: true, somatic: true, material: true,
      material_specified: "...",
      duration: "Instantaneous",
      concentration: false, ritual: false,
      casting_options: [
        { type: "default", damage_roll: null, target_count: null, duration: null, range: null, concentration: null, shape_size: null, desc: null },
        { type: "slot_level_4", damage_roll: "9d6" },
        { type: "slot_level_5", damage_roll: "10d6" },
      ],
    });
    const result = toSpellCanonical(entry);
    expect(result.casting_options).toBeDefined();
    expect(result.casting_options!.find(o => o.type === "default")).toBeUndefined();
    expect(result.casting_options!.find(o => o.type === "slot_level_4")).toBeDefined();
    expect(result.casting_options!.find(o => o.type === "slot_level_4")!.damage_roll).toBe("9d6");
    expect(result.casting_options!.find(o => o.type === "slot_level_5")!.damage_roll).toBe("10d6");
  });

  it("retains 2014 default row if it carries actual scaling info", () => {
    // Edge case: a default row with non-null damage_roll IS scaling info.
    const entry = baseEntry({
      name: "Eldritch Blast",
      level: 0,
      school: { name: "Evocation", key: "evocation" },
      desc: "...",
      casting_time: "action",
      range: 120, range_text: "120 feet",
      verbal: true, somatic: true, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
      casting_options: [
        { type: "default", damage_roll: "1d10", target_count: 1 },
        { type: "player_level_5", damage_roll: "2d10", target_count: 2 },
      ],
    });
    const result = toSpellCanonical(entry);
    // The default row HAS scaling (damage_roll, target_count) — should be kept
    expect(result.casting_options!.find(o => o.type === "default")).toBeDefined();
    expect(result.casting_options!.find(o => o.type === "default")!.damage_roll).toBe("1d10");
  });

  it("does not emit casting_options when source array is missing", () => {
    const entry = baseEntry({
      name: "Wish",
      level: 9,
      school: { name: "Conjuration", key: "conjuration" },
      desc: "...",
      casting_time: "action",
      range: 0, range_text: "Self",
      verbal: true, somatic: false, material: false,
      duration: "Instantaneous",
      concentration: false, ritual: false,
    });
    const result = toSpellCanonical(entry);
    expect(result.casting_options).toBeUndefined();
  });
});
