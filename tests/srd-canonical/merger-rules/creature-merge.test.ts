import { describe, it, expect } from "vitest";
import { toCreatureCanonical } from "../../../tools/srd-canonical/merger-rules/creature-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

describe("creatureMergeRule", () => {
  it("produces canonical Creature for Goblin (small humanoid, CR 1/4)", () => {
    const canonical: CanonicalEntry = {
      slug: "goblin",
      edition: "2014",
      kind: "creature",
      base: {
        key: "goblin",
        name: "Goblin",
        document: { key: "srd-2014", name: "SRD 5.1" },
        size: "Small",
        type: "humanoid",
        desc: "A nasty little creature with sharp teeth.",
        ac: 15,
        hp: { average: 7, formula: "2d6" },
        speed: { walk: 30 },
        abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
        cr: "1/4",
        skills: { stealth: 6 },
        senses: "darkvision 60 ft., passive Perception 9",
        languages: "Common, Goblin",
        actions: [
          { name: "Scimitar", desc: "Melee Weapon Attack: +4 to hit." },
        ],
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toCreatureCanonical(canonical);
    expect(out.slug).toBe("goblin");
    expect(out.name).toBe("Goblin");
    expect(out.edition).toBe("2014");
    expect(out.source).toBe("SRD 5.1");
    expect(out.size).toBe("Small");
    expect(out.type).toBe("humanoid");
    expect(out.ac).toBe(15);
    expect(out.hp.average).toBe(7);
    expect(out.hp.formula).toBe("2d6");
    expect(out.speed.walk).toBe(30);
    expect(out.abilities.str).toBe(8);
    expect(out.abilities.dex).toBe(14);
    expect(out.cr).toBe("1/4");
    expect(out.skills?.stealth).toBe(6);
    expect(out.senses).toContain("darkvision");
    expect(out.languages).toContain("Goblin");
    expect(out.actions?.[0].name).toBe("Scimitar");
    expect(out.legendary_actions).toBeUndefined();
  });

  it("produces canonical Creature for Adult Red Dragon (legendary actions)", () => {
    const canonical: CanonicalEntry = {
      slug: "adult-red-dragon",
      edition: "2014",
      kind: "creature",
      base: {
        key: "adult-red-dragon",
        name: "Adult Red Dragon",
        document: { key: "srd-2014", name: "SRD 5.1" },
        size: "Huge",
        type: "dragon",
        ac: 19,
        hp: { average: 256, formula: "19d12 + 133" },
        speed: { walk: 40, climb: 40, fly: 80 },
        abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
        cr: "17",
        saving_throws: { dex: 6, con: 13, wis: 7, cha: 11 },
        senses: "blindsight 60 ft., darkvision 120 ft., passive Perception 23",
        languages: "Common, Draconic",
        actions: [
          { name: "Bite", desc: "Melee Weapon Attack: +15 to hit." },
          { name: "Fire Breath", desc: "The dragon exhales fire in a 60-foot cone." },
        ],
        legendary_actions: [
          { name: "Detect", desc: "The dragon makes a Wisdom (Perception) check." },
          { name: "Tail Attack", desc: "The dragon makes a tail attack." },
          { name: "Wing Attack (Costs 2 Actions)", desc: "The dragon beats its wings." },
        ],
      },
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toCreatureCanonical(canonical);
    expect(out.size).toBe("Huge");
    expect(out.type).toBe("dragon");
    expect(out.cr).toBe("17");
    expect(out.speed.fly).toBe(80);
    expect(out.saving_throws?.con).toBe(13);
    expect(out.legendary_actions).toBeDefined();
    expect(out.legendary_actions?.length).toBe(3);
    expect(out.legendary_actions?.[2].name).toContain("Wing Attack");
  });
});
