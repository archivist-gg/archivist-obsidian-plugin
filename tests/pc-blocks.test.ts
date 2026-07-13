/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { BackgroundBlock } from "../packages/obsidian/src/modules/pc/blocks/background-block";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

// The class / subclass / race / feat blocks and the Features & Traits tab were
// retired in Phase 2 (§3.8) — their feature surfaces are consolidated onto the
// Actions tab, and `resolveFeatureDescription`/`formatSourceLabel` now live in
// `blocks/feature-card.ts` (covered by pc-feature-card.test.ts). BackgroundBlock
// survives (still used by the Background tab).

beforeAll(() => installObsidianDomHelpers());

function mkResolved(): ResolvedCharacter {
  return {
    definition: { name: "T", edition: "2014", race: "[[hill-folk]]", subrace: null, background: "[[drifter]]", class: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual", skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] }, equipment: [], overrides: {}, state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] } },
    race: {
      slug: "hill-folk", name: "Hill Folk", description: "Hill folk are tough.",
      size: "Medium", speed: { walk: 25 }, vision: { darkvision: 60 },
      traits: [{ name: "Stonecunning", description: "You know stone." }],
    } as never,
    classes: [{
      entity: {
        slug: "bladesworn", name: "Bladesworn", hit_die: "d10",
        saving_throws: ["str", "con"], primary_abilities: ["str"],
        features_by_level: {
          1: [{ name: "Sworn Blade", description: "Your weapon is bound." }],
          4: [{ name: "Ability Score Improvement" }],
        },
      } as never,
      level: 3,
      subclass: {
        slug: "path-of-shadow", name: "Path of Shadow", description: "Shadows.",
        features_by_level: { 3: [{ name: "Shadow Step", description: "Teleport." }] },
      } as never,
      choices: { 1: { skills: ["athletics", "perception"], expertise: ["athletics"] } },
    }],
    background: { slug: "drifter", name: "Drifter", description: "Always moving.", skill_proficiencies: ["insight", "survival"], tool_proficiencies: [], language_proficiencies: [], feature: { name: "Wanderer's Way", description: "Travel is easy." } } as never,
    feats: [{ slug: "sure-step", name: "Sure-Step", description: "Difficult terrain is yours.", prerequisites: ["Dex 13"] } as never],
    totalLevel: 3,
    features: [],
    state: {} as never,
  };
}

const ctx = (): ComponentRenderContext => ({
  resolved: mkResolved(),
  derived: {} as DerivedStats,
  services: {} as never,
  editState: null,
});

describe("BackgroundBlock", () => {
  it("renders background name, skill proficiencies, feature", () => {
    const container = mountContainer();
    new BackgroundBlock().render(container, ctx());
    const root = container.querySelector(".pc-background-block");
    expect(root?.textContent).toContain("Drifter");
    expect(root?.textContent).toContain("Insight");
    expect(root?.textContent).toContain("Wanderer's Way");
  });
});
