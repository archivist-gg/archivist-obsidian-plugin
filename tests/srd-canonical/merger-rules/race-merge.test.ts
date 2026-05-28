import { describe, it, expect } from "vitest";
import { toRaceCanonical } from "../../../tools/srd-canonical/merger-rules/race-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseEntry = (overrides: Partial<CanonicalEntry> & { base: unknown }): CanonicalEntry => ({
  slug: overrides.slug ?? "srd-5e_dwarf",
  edition: overrides.edition ?? ("2014" as const),
  kind: "race",
  base: overrides.base as never,
  structured: overrides.structured ?? null,
  activation: overrides.activation ?? null,
  overlay: overrides.overlay ?? null,
});

describe("race-merge: Open5e v2 species shape", () => {
  it("extracts size from traits[type=SIZE] (2024)", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-2024_dragonborn",
      edition: "2024",
      base: {
        key: "srd-2024_dragonborn",
        name: "Dragonborn",
        is_subspecies: false,
        subspecies_of: null,
        desc: "",
        traits: [
          { name: "Size", desc: "Medium", type: "SIZE", order: 1 },
          { name: "Speed", desc: "30 feet", type: "SPEED", order: 2 },
        ],
      },
    }));
    expect(result.size).toBe("medium");
    expect(result.speed.walk).toBe(30);
  });

  it("extracts size from traits[name=Size] (2014, untyped traits)", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-5e_dwarf",
      edition: "2014",
      base: {
        key: "srd_dwarf",
        name: "Dwarf",
        is_subspecies: false,
        subspecies_of: null,
        desc: "...",
        traits: [
          { name: "Ability Score Increase", desc: "Your Constitution score increases by 2.", type: null, order: null },
          { name: "Size", desc: "Dwarves stand between 4 and 5 feet tall... Your size is Medium.", type: null, order: null },
          { name: "Speed", desc: "Your base walking speed is 25 feet.", type: null, order: null },
        ],
      },
    }));
    expect(result.size).toBe("medium");
    expect(result.speed.walk).toBe(25);
  });

  it("uses native Open5e v2 subspecies_of object for wikilink", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-5e_hill-dwarf",
      edition: "2014",
      base: {
        key: "srd_hill-dwarf",
        name: "Hill Dwarf",
        is_subspecies: true,
        subspecies_of: { name: "Dwarf", key: "srd_dwarf" },
        desc: "...",
        traits: [],
      },
    }));
    expect(result.subspecies_of).toBe("[[SRD 5e/Races/Dwarf]]");
  });

  it("extracts additional movement modes (fly/swim/climb/burrow) from speed trait", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-2024_aarakocra",
      edition: "2024",
      base: {
        key: "srd-2024_aarakocra",
        name: "Aarakocra",
        is_subspecies: false,
        subspecies_of: null,
        desc: "",
        traits: [
          { name: "Speed", desc: "Your walking speed is 30 feet, and you have a fly speed of 50 feet.", type: "SPEED", order: 2 },
        ],
      },
    }));
    expect(result.speed.walk).toBe(30);
    expect(result.speed.fly).toBe(50);
  });
});

describe("raceMergeRule (legacy/structural cases)", () => {
  it("produces canonical Race from Open5e-only entry", () => {
    const canonical: CanonicalEntry = baseEntry({
      slug: "srd-5e_dwarf",
      edition: "2014",
      base: {
        key: "srd_dwarf",
        name: "Dwarf",
        desc: "Born of stone…",
        is_subspecies: false,
        subspecies_of: null,
        traits: [
          { name: "Size", desc: "Your size is Medium.", type: null, order: null },
          { name: "Speed", desc: "Your base walking speed is 25 feet.", type: null, order: null },
          { name: "Darkvision", desc: "{@i 60 feet}.", type: null, order: null },
          { name: "Stonecunning", desc: "Whenever you make an Intelligence (History) check related to stone…", type: null, order: null },
        ],
      },
    });
    const out = toRaceCanonical(canonical);
    expect(out.slug).toBe("srd-5e_dwarf");
    expect(out.edition).toBe("2014");
    expect(out.size).toBe("medium");
    expect(out.speed.walk).toBe(25);
    expect(out.traits.length).toBe(4);
    expect(out.subspecies_of).toBeUndefined();
  });

  it("populates additional_spells from structured-rules `additionalSpells`", () => {
    const canonical: CanonicalEntry = baseEntry({
      slug: "srd-5e_tiefling",
      edition: "2014",
      base: {
        key: "srd_tiefling",
        name: "Tiefling",
        desc: "...",
        is_subspecies: false,
        subspecies_of: null,
        traits: [],
      },
      structured: {
        name: "Tiefling",
        source: "PHB",
        additionalSpells: [{
          known: { "1": ["thaumaturgy"] },
          innate: { "3": ["hellish rebuke"], "5": ["darkness"] },
        }],
      } as never,
    });
    const out = toRaceCanonical(canonical);
    expect(out.additional_spells?.innate).toBeDefined();
    expect(out.additional_spells?.innate?.["3"]).toContain("[[SRD 5e/Spells/Hellish Rebuke|hellish rebuke]]");
  });

  it("merges overlay race_traits action economy onto matching trait by slug", () => {
    const canonical: CanonicalEntry = baseEntry({
      slug: "srd-5e_dragonborn",
      edition: "2014",
      base: {
        key: "srd_dragonborn",
        name: "Dragonborn",
        desc: "...",
        is_subspecies: false,
        subspecies_of: null,
        traits: [
          { name: "Breath Weapon", desc: "Use action to exhale destructive energy.", type: null, order: null },
        ],
      },
      overlay: {
        "breath-weapon": {
          action_cost: "action",
          save: { ability: "dex", dc_formula: "8 + PB + CON" },
          damage: { dice: "2d6", type: "(varies)" },
          recharge: "short-rest",
        },
      } as never,
    });
    const out = toRaceCanonical(canonical);
    const breathWeapon = out.traits.find(t => t.name === "Breath Weapon");
    expect(breathWeapon?.action_cost).toBe("action");
    expect(breathWeapon?.save?.ability).toBe("dex");
    expect(breathWeapon?.damage?.dice).toBe("2d6");
  });

  it("emits minimum schema-required defaults for harness compatibility", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-5e_human",
      edition: "2014",
      base: {
        key: "srd_human",
        name: "Human",
        is_subspecies: false,
        subspecies_of: null,
        desc: "...",
        traits: [],
      },
    }));
    expect(result.ability_score_increases).toEqual([]);
    expect(typeof result.age).toBe("string");
    expect(typeof result.alignment).toBe("string");
    expect(result.vision).toBeDefined();
    expect(typeof result.vision).toBe("object");
    expect(result.languages).toBeDefined();
    expect(Array.isArray(result.languages.fixed)).toBe(true);
    expect(typeof result.variant_label).toBe("string");
    expect(result.variant_label.length).toBeGreaterThan(0);
  });

  it("renames trait field from `desc` to `description` to match feature schema", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-5e_dwarf",
      edition: "2014",
      base: {
        key: "srd_dwarf",
        name: "Dwarf",
        is_subspecies: false,
        subspecies_of: null,
        desc: "...",
        traits: [
          { name: "Stonecunning", desc: "Whenever you make...", type: null, order: null },
        ],
      },
    }));
    expect(result.traits[0].description).toContain("Whenever you make");
    expect((result.traits[0] as Record<string, unknown>).desc).toBeUndefined();
  });

  it("auto-extracts darkvision range from a Darkvision trait", () => {
    const result = toRaceCanonical(baseEntry({
      slug: "srd-5e_dwarf",
      edition: "2014",
      base: {
        key: "srd_dwarf",
        name: "Dwarf",
        is_subspecies: false,
        subspecies_of: null,
        desc: "...",
        traits: [
          { name: "Darkvision", desc: "60 feet", type: null, order: null },
        ],
      },
    }));
    expect(result.vision.darkvision).toBe(60);
  });

  it("activation companion fills gaps but loses to overlay", () => {
    const canonical: CanonicalEntry = baseEntry({
      slug: "srd-5e_dragonborn",
      edition: "2014",
      base: {
        key: "srd_dragonborn",
        name: "Dragonborn",
        desc: "...",
        is_subspecies: false,
        subspecies_of: null,
        traits: [{ name: "Breath Weapon", desc: "...", type: null, order: null }],
      },
      activation: { activation: { type: "passive", value: 0 } } as never,
      overlay: { "breath-weapon": { action_cost: "action" } } as never,
    });
    const out = toRaceCanonical(canonical);
    expect(out.traits[0].action_cost).toBe("action");  // overlay wins over passive
  });
});
