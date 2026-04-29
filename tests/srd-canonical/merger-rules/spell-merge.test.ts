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
        school: "Evocation",
        casting_time: "1 action",
        range: "150 feet",
        components: "V, S, M (a tiny ball of bat guano and sulfur)",
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
    expect(out.school).toBe("Evocation");
    expect(out.casting_time).toBe("1 action");
    expect(out.range).toBe("150 feet");
    expect(out.components).toContain("V, S, M");
    expect(out.duration).toBe("Instantaneous");
    expect(out.concentration).toBe(false);
    expect(out.ritual).toBe(false);
    expect(out.description).toContain("bright streak");
    expect(out.damage?.types).toEqual(["fire"]);
    expect(out.saving_throw?.ability).toBe("dexterity");
    expect(out.at_higher_levels).toContain("4th level or higher");
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
        school: "Conjuration",
        casting_time: "1 action",
        range: "Self",
        components: "V",
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
    expect(out.school).toBe("Conjuration");
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
        school: "Abjuration",
        casting_time: "1 action",
        range: "120 feet",
        components: "V, S",
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
    expect(out.school).toBe("Abjuration");
    expect(out.concentration).toBe(false);
    expect(out.ritual).toBe(false);
    expect(out.description).toContain("Choose any creature");
  });
});
