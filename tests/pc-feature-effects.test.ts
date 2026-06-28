import { describe, it, expect } from "vitest";
import { computeFeatureEffects, emptyFeatureEffectTotals } from "../packages/obsidian/src/modules/pc/pc.feature-effects";
import type { ResolvedFeature } from "../packages/obsidian/src/modules/pc/pc.types";
import type { FeatureEffect } from "../packages/obsidian/src/shared/types/feature-effect";

function rf(effects: FeatureEffect[], name = "Test Feature"): ResolvedFeature {
  return { feature: { name, effects }, source: { kind: "race", slug: "test-race" } };
}

describe("computeFeatureEffects", () => {
  it("returns the empty shape for no features / no effects / absent effects", () => {
    expect(computeFeatureEffects([])).toEqual(emptyFeatureEffectTotals());
    expect(computeFeatureEffects([rf([])])).toEqual(emptyFeatureEffectTotals());
    expect(
      computeFeatureEffects([{ feature: { name: "Plain" }, source: { kind: "race", slug: "r" } }]),
    ).toEqual(emptyFeatureEffectTotals());
  });

  it("sums initiative-bonus, hp-per-level-bonus and walk speed-bonus", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "initiative-bonus", value: 2 }, { kind: "hp-per-level-bonus", value: 1 }]),
      rf([{ kind: "initiative-bonus", value: 1 }, { kind: "speed-bonus", mode: "walk", value: 5 }]),
      rf([{ kind: "speed-bonus", mode: "walk", value: 10 }]),
    ]);
    expect(out.initiative_bonus).toBe(3);
    expect(out.hp_per_level_bonus).toBe(1);
    expect(out.speed_walk_bonus).toBe(15);
  });

  it("ignores non-walk speed-bonus modes (deferred — no derived surface)", () => {
    const out = computeFeatureEffects([rf([{ kind: "speed-bonus", mode: "fly", value: 30 }])]);
    expect(out.speed_walk_bonus).toBe(0);
  });

  it("takes the max range per sense type", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "sense", type: "darkvision", range: 60 }]),
      rf([{ kind: "sense", type: "darkvision", range: 120 }]),
      rf([{ kind: "sense", type: "truesight", range: 30 }]),
    ]);
    expect(out.senses.darkvision).toBe(120);
    expect(out.senses.truesight).toBe(30);
    expect(out.senses.blindsight).toBe(0);
  });

  it("unions resistances case-insensitively, first spelling wins", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "resistance", damage_type: "Fire" }]),
      rf([{ kind: "resistance", damage_type: "fire" }]),
      rf([{ kind: "resistance", damage_type: "Cold" }]),
    ]);
    expect(out.resistances).toEqual(["Fire", "Cold"]);
  });

  it("applies ungated immune-condition and skips while-gated entries", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "immune-condition", condition: "Charmed" }]),
      rf([{ kind: "immune-condition", condition: "Frightened", while: "while raging" }]),
    ]);
    expect(out.condition_immunities).toEqual(["Charmed"]);
  });

  it("buckets proficiency effects; skills normalize to kebab, saves to ability keys", () => {
    const out = computeFeatureEffects([
      rf([
        { kind: "proficiency", proficiency_type: "skill", value: "Animal Handling" },
        { kind: "proficiency", proficiency_type: "tool", value: "Thieves' Tools" },
        { kind: "proficiency", proficiency_type: "language", value: "Draconic" },
        { kind: "proficiency", proficiency_type: "saving-throw", value: "Wisdom" },
        { kind: "proficiency", proficiency_type: "saving-throw", value: "dex" },
      ]),
    ]);
    expect(out.proficiencies.skills).toEqual(["animal-handling"]);
    expect(out.proficiencies.tools).toEqual(["Thieves' Tools"]);
    expect(out.proficiencies.languages).toEqual(["Draconic"]);
    expect(out.proficiencies.saves).toEqual(["wis", "dex"]);
  });

  it("drops unrecognized saving-throw values", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "proficiency", proficiency_type: "saving-throw", value: "luck" }]),
    ]);
    expect(out.proficiencies.saves).toEqual([]);
  });

  it("dedupes saves given the same ability as full name and key", () => {
    const out = computeFeatureEffects([
      rf([
        { kind: "proficiency", proficiency_type: "saving-throw", value: "Wisdom" },
        { kind: "proficiency", proficiency_type: "saving-throw", value: "wis" },
      ]),
    ]);
    expect(out.proficiencies.saves).toEqual(["wis"]);
  });

  it("buckets armor and weapon proficiency category effects, lowercased (category form)", () => {
    // Armor/weapon grants are CATEGORIES, kept as bare lowercase words (no kebab)
    // so they match the matcher's `.categories` form ("heavy", "martial", "shield").
    const out = computeFeatureEffects([
      rf([
        { kind: "proficiency", proficiency_type: "armor", value: "Heavy" },
        { kind: "proficiency", proficiency_type: "weapon", value: "Martial" },
      ]),
    ]);
    expect(out.proficiencies.armor).toEqual(["heavy"]);
    expect(out.proficiencies.weapons).toEqual(["martial"]);
  });

  it("tracks speed_walk_set as the max of set values, separate from additive bonus", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "speed-bonus", mode: "walk", set: true, value: 40 }]),
      rf([{ kind: "speed-bonus", mode: "walk", set: true, value: 60 }]),
      rf([{ kind: "speed-bonus", mode: "walk", value: 10 }]),
    ]);
    expect(out.speed_walk_set).toBe(60);
    expect(out.speed_walk_bonus).toBe(10);
  });

  it("collects ac-bonus terms with feature-name labels and gating flag", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "ac-bonus", value: 1, requires_armor: true }], "Defense"),
      rf([{ kind: "ac-bonus", value: 2 }], "Mystic Shield"),
    ]);
    expect(out.ac_terms).toEqual([
      { value: 1, requires_armor: true, label: "Defense" },
      { value: 2, requires_armor: false, label: "Mystic Shield" },
    ]);
  });

  it("collects ac-bonus terms from two same-named features as separate terms", () => {
    const out = computeFeatureEffects([
      rf([{ kind: "ac-bonus", value: 1 }], "Defense"),
      rf([{ kind: "ac-bonus", value: 1 }], "Defense"),
    ]);
    expect(out.ac_terms).toEqual([
      { value: 1, requires_armor: false, label: "Defense" },
      { value: 1, requires_armor: false, label: "Defense" },
    ]);
  });

  it("skips activatable feature effects unless the id is active", () => {
    const feat: ResolvedFeature = {
      feature: { id: "majesty", name: "Infernal Majesty", activatable: true, effects: [{ kind: "ac-bonus", value: 2 }] } as never,
      source: { kind: "class", slug: "reaver" } as never,
    };
    // Off by default (no opts) and off when the active set lacks the id.
    expect(computeFeatureEffects([feat]).ac_terms).toEqual([]);
    expect(computeFeatureEffects([feat], { activeBuffs: new Set<string>() }).ac_terms).toEqual([]);
    // Folds only when the id is in the active set.
    expect(computeFeatureEffects([feat], { activeBuffs: new Set(["majesty"]) }).ac_terms).toEqual([
      { value: 2, requires_armor: false, label: "Infernal Majesty" },
    ]);
  });

  it("folds non-activatable feature effects unconditionally (active set irrelevant)", () => {
    const feat = rf([{ kind: "ac-bonus", value: 1 }], "Shield of Faith");
    expect(computeFeatureEffects([feat]).ac_terms).toEqual([
      { value: 1, requires_armor: false, label: "Shield of Faith" },
    ]);
    // An empty (or unrelated) active set never suppresses a non-activatable feature.
    expect(computeFeatureEffects([feat], { activeBuffs: new Set(["other"]) }).ac_terms).toEqual([
      { value: 1, requires_armor: false, label: "Shield of Faith" },
    ]);
  });

  it("skips action-time kinds and unknown kinds without throwing", () => {
    const out = computeFeatureEffects([
      rf([
        { kind: "apply-condition", condition: "Prone" },
        { kind: "damage-bonus", damage_type: "fire", amount: "1d6" },
        { kind: "future-kind", whatever: 1 } as unknown as FeatureEffect,
      ]),
    ]);
    expect(out).toEqual(emptyFeatureEffectTotals());
  });
});
