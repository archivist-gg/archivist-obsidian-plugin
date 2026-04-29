import { describe, it, expect } from "vitest";
import { toClassCanonical } from "../../../tools/srd-canonical/merger-rules/class-merge";
import type { CanonicalEntry } from "../../../tools/srd-canonical/merger";

const baseFighter = {
  key: "fighter",
  name: "Fighter",
  desc: "A master of martial combat…",
  document: { key: "srd-2014", name: "SRD 5.1" },
  hit_dice: "1d10",
  prof_armor: "All armor, shields",
  prof_weapons: "Simple weapons, martial weapons",
  prof_tools: "",
  prof_saving_throws: "Strength, Constitution",
  prof_skills: "Choose two from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, and Survival",
  features: [
    { level: 1, name: "Fighting Style", desc: "You adopt a particular style of fighting…" },
    { level: 2, name: "Action Surge", desc: "On your turn, you can take one additional action." },
  ],
};

describe("classMergeRule", () => {
  it("produces canonical Class from Open5e-only entry", () => {
    const canonical: CanonicalEntry = {
      slug: "fighter",
      edition: "2014",
      kind: "class",
      base: baseFighter,
      structured: null,
      activation: null,
      overlay: null,
    };
    const out = toClassCanonical(canonical);
    expect(out.slug).toBe("fighter");
    expect(out.edition).toBe("2014");
    expect(out.hit_dice).toBe("1d10");
    expect(out.features.length).toBe(2);
    expect(out.features[0].name).toBe("Fighting Style");
    expect(out.features[1].level).toBe(2);
    expect(out.proficiencies?.armor).toContain("All armor");
    expect(out.proficiencies?.saves).toContain("Strength");
  });

  it("merges overlay class_features action economy onto matching feature by slug", () => {
    const canonical: CanonicalEntry = {
      slug: "fighter",
      edition: "2014",
      kind: "class",
      base: baseFighter,
      structured: null,
      activation: null,
      overlay: {
        "action-surge": {
          action_cost: "special",
          uses: { max: 1, recharge: "short-rest" },
        },
      },
    };
    const out = toClassCanonical(canonical);
    const surge = out.features.find(f => f.name === "Action Surge");
    expect(surge?.action_cost).toBe("special");
    expect(surge?.uses?.max).toBe(1);
    expect(surge?.uses?.recharge).toBe("short-rest");
  });

  it("populates spellcasting from structured-rules", () => {
    const canonical: CanonicalEntry = {
      slug: "wizard",
      edition: "2014",
      kind: "class",
      base: { ...baseFighter, key: "wizard", name: "Wizard", hit_dice: "1d6" },
      structured: {
        name: "Wizard",
        source: "PHB",
        spellcasting: { ability: "int", progression: "full", prepared: true },
      } as never,
      activation: null,
      overlay: null,
    };
    const out = toClassCanonical(canonical);
    expect(out.spellcasting?.ability).toBe("int");
    expect(out.spellcasting?.type).toBe("full");
    expect(out.spellcasting?.prepared).toBe(true);
  });
});
