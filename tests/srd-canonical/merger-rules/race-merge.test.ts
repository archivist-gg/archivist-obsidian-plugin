import { describe, it, expect } from "vitest";
import { toRaceCanonical } from "../../../tools/srd-canonical/merger-rules/race-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseDwarf = {
  key: "dwarf",
  name: "Dwarf",
  desc: "Born of stone…",
  document: { key: "srd-2014", name: "SRD 5.1" },
  size: "Medium",
  speed: { walk: 25 },
  traits: [
    { name: "Darkvision", desc: "{@i 60 feet}.", type: "VISION" },
    { name: "Stonecunning", desc: "Whenever you make an Intelligence (History) check related to stone…" },
  ],
};

describe("raceMergeRule", () => {
  it("produces canonical Race from Open5e-only entry", () => {
    const canonical: CanonicalEntry = {
      slug: "dwarf", edition: "2014", kind: "race",
      base: baseDwarf, structured: null, activation: null, overlay: null,
    };
    const out = toRaceCanonical(canonical);
    expect(out.slug).toBe("dwarf");
    expect(out.edition).toBe("2014");
    expect(out.size).toBe("medium");
    expect(out.speed.walk).toBe(25);
    expect(out.traits.length).toBe(2);
    expect(out.subspecies_of).toBeUndefined();
  });

  it("populates additional_spells from structured-rules `additionalSpells`", () => {
    const canonical: CanonicalEntry = {
      slug: "tiefling", edition: "2014", kind: "race",
      base: { ...baseDwarf, key: "tiefling", name: "Tiefling" },
      structured: {
        name: "Tiefling",
        source: "PHB",
        additionalSpells: [{
          known: { "1": ["thaumaturgy"] },
          innate: { "3": ["hellish rebuke"], "5": ["darkness"] },
        }],
      } as never,
      activation: null, overlay: null,
    };
    const out = toRaceCanonical(canonical);
    expect(out.additional_spells?.innate).toBeDefined();
    expect(out.additional_spells?.innate?.["3"]).toContain("[[SRD 5e/Spells/Hellish Rebuke|hellish rebuke]]");
  });

  it("merges overlay race_traits action economy onto matching trait by slug", () => {
    const canonical: CanonicalEntry = {
      slug: "dragonborn", edition: "2014", kind: "race",
      base: { ...baseDwarf, key: "dragonborn", name: "Dragonborn", traits: [{ name: "Breath Weapon", desc: "Use action to exhale destructive energy." }] },
      structured: null, activation: null,
      overlay: {
        "breath-weapon": {
          action_cost: "action",
          save: { ability: "dex", dc_formula: "8 + PB + CON" },
          damage: { dice: "2d6", type: "(varies)" },
          recharge: "short-rest",
        },
      },
    };
    const out = toRaceCanonical(canonical);
    const breathWeapon = out.traits.find(t => t.name === "Breath Weapon");
    expect(breathWeapon?.action_cost).toBe("action");
    expect(breathWeapon?.save?.ability).toBe("dex");
    expect(breathWeapon?.damage?.dice).toBe("2d6");
  });

  it("activation companion fills gaps but loses to overlay", () => {
    const canonical: CanonicalEntry = {
      slug: "dragonborn", edition: "2014", kind: "race",
      base: { ...baseDwarf, key: "dragonborn", name: "Dragonborn", traits: [{ name: "Breath Weapon", desc: "..." }] },
      structured: null,
      activation: { activation: { type: "passive", value: 0 } } as never,
      overlay: { "breath-weapon": { action_cost: "action" } },
    };
    const out = toRaceCanonical(canonical);
    expect(out.traits[0].action_cost).toBe("action");  // overlay wins over passive
  });
});
