import { describe, it, expect } from "vitest";
import { PCResolver } from "../src/modules/pc/pc.resolver";
import { buildDecisionLedger } from "../src/modules/pc/pc.decision-engine";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { Character } from "../src/modules/pc/pc.types";

// Every gained class/subclass feature should surface in the per-level strip — as a
// choice if it has one, otherwise as an "informational" card — so the builder shows
// a complete per-level view (no silent gaps for plain-flavor features like Blood
// Price / Forked Tongue Improvement, which previously appeared only in the
// Features-by-level fold). Synthetic resource-only carriers (entity-level resources,
// no prose) are NOT surfaced.

const CLASS = {
  slug: "testclass", name: "Test Class", edition: "2014", hit_die: "d10",
  primary_abilities: ["str"], saving_throws: ["str", "con"],
  proficiencies: { armor: [], weapons: { categories: ["simple"] } },
  skill_choices: { count: 1, from: ["athletics"] }, starting_equipment: [],
  spellcasting: null, subclass_level: 3, subclass_feature_name: "Path",
  weapon_mastery: null, epic_boon_level: null, table: {},
  features_by_level: {
    "1": [{ id: "plain-flavor", name: "Plain Flavor", description: "You gain a passive perk. No decision here." }],
    "2": [{ id: "with-choice", name: "With Choice", description: "Pick a thing.",
      choices: [{ kind: "select-proficiency", id: "thing", count: 1, domain: "skill", from: ["arcana", "history"] }] }],
  },
  // Entity-level resources synthesize a name-only carrier feature (no prose) — must NOT card.
  resources: [{ id: "tc:res", name: "Resource Pool", max_formula: "1", reset: "long-rest" }],
};

function charAt(level: number): Character {
  return {
    name: "T", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "[[testclass]]", level, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
      conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  } as unknown as Character;
}

function items(level: number) {
  const reg = buildMockRegistry([{ slug: "testclass", name: "Test Class", entityType: "class", data: CLASS }]);
  const { character: resolved } = new PCResolver(reg).resolve(charAt(level));
  return buildDecisionLedger(resolved, { registry: reg }).classes[0].levels.flatMap((l) => l.items);
}

describe("decision strip surfaces every gained feature", () => {
  it("emits an informational item for a plain-flavor feature (no choice, no decision phrase)", () => {
    const plain = items(2).find((i) => i.featureName === "Plain Flavor");
    expect(plain).toBeTruthy();
    expect(plain!.status).toBe("informational");
    expect(plain!.level).toBe(1);
  });

  it("still surfaces a real choice feature as a decision (not informational)", () => {
    const choice = items(2).find((i) => i.featureName === "With Choice");
    expect(choice).toBeTruthy();
    expect(choice!.status).not.toBe("informational");
  });

  it("does NOT card a synthetic resource-only carrier (entity-level resources, no prose)", () => {
    const carrier = items(2).find((i) => i.featureName === "Test Class");
    expect(carrier).toBeUndefined();
  });
});
