import { describe, it, expect } from "vitest";
import { overlaySchema } from "../../../tools/srd-canonical/overlay.schema";

describe("overlaySchema", () => {
  it("accepts class_features with action economy", () => {
    const overlay = {
      class_features: {
        "action-surge": {
          action_cost: "special",
          uses: { max: 1, recharge: "short-rest", scales_at: [{ level: 17, value: 2 }] },
        },
      },
    };
    expect(overlaySchema.safeParse(overlay).success).toBe(true);
  });

  it("accepts optional_feature_slugs map", () => {
    const overlay = {
      optional_feature_slugs: {
        invocation: ["agonizing-blast", "devil-sight"],
        fighting_style: ["defense", "dueling"],
      },
    };
    expect(overlaySchema.safeParse(overlay).success).toBe(true);
  });

  it("rejects unknown action_cost", () => {
    const bad = { class_features: { x: { action_cost: "magical-action" } } };
    expect(overlaySchema.safeParse(bad).success).toBe(false);
  });

  it("accepts optional_features and feats entries carrying entity-level effects", () => {
    const overlay = {
      optional_features: {
        defense: { effects: [{ kind: "ac-bonus", value: 1, requires_armor: true }] },
      },
      feats: {
        defense: { effects: [{ kind: "ac-bonus", value: 1, requires_armor: true }] },
      },
    };
    expect(overlaySchema.safeParse(overlay).success).toBe(true);
  });

  it("rejects unknown keys inside an entity-effects entry", () => {
    const bad = {
      optional_features: { defense: { effects: [{ kind: "ac-bonus", value: 1 }], bogus: true } },
    };
    expect(overlaySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty effects arrays in entity-effects entries", () => {
    const bad = { feats: { defense: { effects: [] } } };
    expect(overlaySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects malformed effects in entity-effects entries", () => {
    const bad = { feats: { defense: { effects: [{ kind: "ac-bonus" }] } } };
    expect(overlaySchema.safeParse(bad).success).toBe(false);
  });
});

describe("overlay resources", () => {
  it("accepts and retains a class feature resources array", () => {
    const r = overlaySchema.safeParse({
      class_features: {
        rage: {
          action_cost: "bonus-action",
          resources: [{
            id: "barbarian:rage", name: "Rage", max_formula: "2",
            scales_at: [{ level: 3, max: "3" }], reset: "long-rest",
          }],
        },
      },
    });
    expect(r.success && r.data.class_features?.rage?.resources?.length).toBe(1);
    expect(r.success && r.data.class_features?.rage?.resources?.[0]?.id).toBe("barbarian:rage");
  });

  it("accepts and retains feat_features and background_features sections", () => {
    const r = overlaySchema.safeParse({
      feat_features: {
        lucky: { resources: [{ id: "feat:lucky", name: "Luck Points", max_formula: "prof", reset: "long-rest" }] },
      },
      background_features: {},
    });
    expect(r.success && r.data.feat_features?.lucky?.resources?.[0]?.id).toBe("feat:lucky");
    expect(r.success && r.data.background_features !== undefined).toBe(true);
  });
});

describe("overlay choices (SP2 Plan 3)", () => {
  it("accepts feature choices, scoped keys, and noChoices opt-out", () => {
    const r = overlaySchema.safeParse({
      class_features: {
        "ability-score-improvement": { choices: [{
          kind: "select-inline", id: "asi-or-feat", count: 1,
          options: [
            { value: "asi", label: "Ability Score Increase",
              choices: [{ kind: "ability-points", id: "asi", points: 2, max_per: 2 }] },
            { value: "feat", label: "Feat",
              choices: [{ kind: "select-entity", id: "feat", entity_type: "feat", count: 1 }] },
          ],
        }] },
        "fighter:fighting-style": { choices: [{
          kind: "select-entity", id: "fighting-style", count: 1,
          entity_type: "optional-feature",
          where: { feature_type: "fighting_style", available_to: "self" },
        }] },
        "spellcasting": { noChoices: true },
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepts entity-level classes/races/backgrounds sections", () => {
    const r = overlaySchema.safeParse({
      classes: { fighter: {
        skill_choices: { count: 2, from: ["acrobatics", "athletics"] },
        starting_equipment: [
          { kind: "choice", options: [
            { label: "(a) chain mail", grants: [{ item: "chain-mail" }] },
            { label: "(b) leather armor, longbow, 20 arrows", grants: [{ item: "leather-armor" }, { item: "longbow" }, { item: "arrow", qty: 20 }] },
          ] },
          { kind: "fixed", grants: [{ item: "light-crossbow" }, { item: "bolt", qty: 20 }] },
        ],
        subclass_level: 3,
        subclass_feature_name: "Martial Archetype",
      } },
      races: { "half-elf": { choices: [
        { kind: "select-proficiency", id: "skills", domain: "skill", count: 2 },
      ] } },
      backgrounds: { acolyte: { choices: [
        { kind: "select-proficiency", id: "languages", domain: "language", count: 2 },
      ] } },
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed choices", () => {
    expect(overlaySchema.safeParse({
      class_features: { expertise: { choices: [{ kind: "select-proficiency", id: "x", domain: "skill" }] } },
    }).success).toBe(false); // missing count
  });
});
