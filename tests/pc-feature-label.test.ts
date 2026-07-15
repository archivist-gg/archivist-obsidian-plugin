import { describe, it, expect } from "vitest";
import { formatSourceLabel } from "../packages/obsidian/src/modules/pc/blocks/feature-card";

// `formatSourceLabel` builds the italic source subtitle on PC feature/action
// cards, delegating name title-casing to the module-private `capitalizeSlug`.
// Compendium slugs carry a leading namespace prefix ("mcdm_", "srd-2024_",
// "srd-5e_", …) that must be stripped so labels read cleanly ("Illrigger 3",
// not "Mcdm_illrigger 3"). Real format (confirmed against source):
//   class/subclass → `${name} ${level}`   race → bare name
//   background     → `Background: ${name}` feat → `Feat: ${name}`
describe("source label cleanup", () => {
  it("strips compendium namespace and title-cases", () => {
    expect(formatSourceLabel({ kind: "class", slug: "mcdm_illrigger", level: 3 })).toBe("Illrigger 3");
    expect(formatSourceLabel({ kind: "subclass", slug: "mcdm_hellspeaker", level: 3 })).toBe("Hellspeaker 3");
    expect(formatSourceLabel({ kind: "race", slug: "eberron_kalashtar" })).toBe("Kalashtar");
    expect(formatSourceLabel({ kind: "feat", slug: "srd-2024_ability-score-improvement" }))
      .toBe("Feat: Ability Score Improvement");
    expect(formatSourceLabel({ kind: "class", slug: "srd-5e_barbarian", level: 2 })).toBe("Barbarian 2");
    expect(formatSourceLabel({ kind: "background", slug: "srd-2024_soldier" })).toBe("Background: Soldier");
  });

  it("leaves a bare (no-namespace) slug unchanged", () => {
    expect(formatSourceLabel({ kind: "class", slug: "fighter", level: 1 })).toBe("Fighter 1");
    expect(formatSourceLabel({ kind: "race", slug: "elf" })).toBe("Elf");
  });
});
