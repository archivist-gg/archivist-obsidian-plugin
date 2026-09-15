/** @vitest-environment jsdom */
/**
 * R4-G7 T8 RIDER-28 (F-ARTICLE, found live in W-A2 `shots/W-A2-green/illrigger-probe/panel-spells__1.png`) · the no-spellcasting
 * empty state needs no indefinite article before the class name.
 *
 * It read "Baelor Nightwarden is a Illrigger with no spellcasting feature.": the class name is DATA, and an a / an rule is an
 * English heuristic that fails on names (a vowel letter is not a vowel sound), so the sentence is rewritten to need no
 * article at all rather than choosing one.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SpellsTab } from "../packages/obsidian/src/modules/pc/components/spells-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const emptyState = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] };
function subtitleFor(name: string, classes: object[]): string {
  const resolved = {
    definition: { name, edition: "2024", class: [], spells: { known: [], overrides: [] }, equipment: [], overrides: {}, state: emptyState },
    race: null, classes, background: null, feats: [], totalLevel: 12, features: [], spells: [], state: emptyState,
  } as unknown as ResolvedCharacter;
  const derived = { spellcastingClasses: [], derivedSpellSlots: {}, pactMagic: null, spellLimits: [] } as unknown as DerivedStats;
  const c = mountContainer();
  new SpellsTab().render(c, { resolved, derived, services: {} as never, app: {} as never, editState: null });
  return c.querySelector(".pc-spells-empty-subtitle")?.textContent ?? "";
}

describe("RIDER-28 · the no-spellcasting sentence carries no indefinite article", () => {
  it("names the character and the class without an article (the user's Illrigger)", () => {
    const text = subtitleFor("Baelor Nightwarden", [{ entity: { slug: "mcdm_class_illrigger", name: "Illrigger" }, level: 12 }]);
    expect(text).toBe("Baelor Nightwarden has no spellcasting feature from the Illrigger class.");
    expect(text).not.toMatch(/\ban? Illrigger\b/);
  });

  it("a class name starting with a consonant reads the same way", () => {
    expect(subtitleFor("Tordek", [{ entity: { slug: "fighter", name: "Fighter" }, level: 3 }]))
      .toBe("Tordek has no spellcasting feature from the Fighter class.");
  });

  it("a character whose class entity did not resolve still reads a whole sentence", () => {
    expect(subtitleFor("Tordek", [{ entity: null, level: 3 }])).toBe("Tordek has no spellcasting feature from this class.");
  });
});
