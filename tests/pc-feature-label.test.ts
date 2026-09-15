import { describe, it, expect } from "vitest";
import { formatSourceLabel } from "../packages/obsidian/src/modules/pc/blocks/feature-card";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

// `formatSourceLabel` builds the italic source subtitle on PC feature/action
// cards, delegating name title-casing to the module-private `capitalizeSlug`.
// Compendium slugs carry a leading namespace prefix ("mcdm_", "srd-2024_",
// "srd-5e_", …) that must be stripped so labels read cleanly ("Illrigger 3",
// not "Mcdm_illrigger 3"). Real format (confirmed against source):
//   class/subclass → `${name} ${level}`   race → bare name
//   background     → `Background: ${name}`
//   feat           → its `via` through the class / background arm, else `Feat` (R4-G7 T8 RIDER-23; the feat's own
//                    name is the row's title, so the line never repeats it)
describe("source label cleanup", () => {
  it("strips compendium namespace and title-cases", () => {
    expect(formatSourceLabel({ kind: "class", slug: "mcdm_illrigger", level: 3 })).toBe("Illrigger 3");
    expect(formatSourceLabel({ kind: "subclass", slug: "mcdm_hellspeaker", level: 3 })).toBe("Hellspeaker 3");
    expect(formatSourceLabel({ kind: "race", slug: "eberron_kalashtar" })).toBe("Kalashtar");
    expect(formatSourceLabel({ kind: "feat", slug: "srd-2024_ability-score-improvement", via: { kind: "class", slug: "srd-2024_fighter", level: 4 } }))
      .toBe("Fighter 4");
    expect(formatSourceLabel({ kind: "class", slug: "srd-5e_barbarian", level: 2 })).toBe("Barbarian 2");
    expect(formatSourceLabel({ kind: "background", slug: "srd-2024_soldier" })).toBe("Background: Soldier");
  });

  it("strips the type token from a 3-part type-namespaced slug", () => {
    expect(formatSourceLabel({ kind: "class", slug: "mcdm_class_illrigger", level: 3 })).toBe("Illrigger 3");
    expect(formatSourceLabel({ kind: "subclass", slug: "mcdm_subclass_hellspeaker", level: 3 })).toBe("Hellspeaker 3");
    expect(formatSourceLabel({ kind: "feat", slug: "srd-2024_feat_ability-score-improvement", via: { kind: "class", slug: "srd-2024_class_fighter", level: 4 } }))
      .toBe("Fighter 4");
    expect(formatSourceLabel({ kind: "background", slug: "srd-2024_background_soldier" })).toBe("Background: Soldier");
  });

  // R4 {G5, G6} live rider N-3-17 / N-1-9 / N-1-13: the converter's class and subclass slugs carry the
  // edition and the book ("oath-of-devotion-2024-xphb", "battle-master-5e"), so title-casing the slug
  // printed `Oath Of Devotion 2024 Xphb 20` and `Battle Master 5e 3` under a row's name. The character
  // already carries the entity, and the entity carries the display NAME.
  it("prints the resolved entity's own name when the character carries it", () => {
    const resolved = {
      classes: [{
        entity: { slug: "phb-2024_class_paladin", name: "Paladin" },
        subclass: { slug: "phb-2024_subclass_oath-of-devotion-2024-xphb", name: "Oath of Devotion" },
      }],
      race: { slug: "phb-2024_race_wood-elf-2024-xphb", name: "Wood Elf" },
      background: { slug: "phb-2024_background_acolyte-2024-xphb", name: "Acolyte" },
      feats: [{ slug: "phb-2024_feat_alert-2024-xphb", name: "Alert" }],
    } as unknown as ResolvedCharacter;
    expect(formatSourceLabel({ kind: "subclass", slug: "phb-2024_subclass_oath-of-devotion-2024-xphb", level: 20 }, resolved))
      .toBe("Oath of Devotion 20");
    expect(formatSourceLabel({ kind: "class", slug: "phb-2024_class_paladin", level: 20 }, resolved)).toBe("Paladin 20");
    expect(formatSourceLabel({ kind: "race", slug: "phb-2024_race_wood-elf-2024-xphb" }, resolved)).toBe("Wood Elf");
    expect(formatSourceLabel({ kind: "background", slug: "phb-2024_background_acolyte-2024-xphb" }, resolved))
      .toBe("Background: Acolyte");
    expect(formatSourceLabel({ kind: "feat", slug: "phb-2024_feat_alert-2024-xphb", via: { kind: "background", slug: "phb-2024_background_acolyte-2024-xphb" } }, resolved))
      .toBe("Background: Acolyte");
    // A slug the character does not carry keeps the title-cased fallback, and so does every call with
    // no resolved character at all (every assertion above this test).
    expect(formatSourceLabel({ kind: "subclass", slug: "mcdm_subclass_hellspeaker", level: 3 }, resolved)).toBe("Hellspeaker 3");
  });

  it("leaves a bare (no-namespace) slug unchanged", () => {
    expect(formatSourceLabel({ kind: "class", slug: "fighter", level: 1 })).toBe("Fighter 1");
    expect(formatSourceLabel({ kind: "race", slug: "elf" })).toBe("Elf");
  });
});
