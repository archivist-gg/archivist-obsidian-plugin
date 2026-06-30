import { describe, it, expect } from "vitest";
import { collectResolvedFeatures, collectChosenGrantedFeatures } from "../packages/obsidian/src/modules/pc/pc.resolver";
import type { FeatEntity } from "@archivist/dnd5e/feat/feat.types";

const noRegistry = { getByTypeAndSlug: () => undefined };

const mkFeat = (over: Partial<FeatEntity>): FeatEntity => ({
  slug: "defense",
  name: "Defense",
  edition: "2024",
  source: "SRD 5.2",
  category: "general",
  description: "+1 AC while wearing armor.",
  prerequisites: [],
  benefits: [],
  effects: [],
  grants_asi: null,
  repeatable: false,
  choices: [],
  ...over,
});

describe("collectResolvedFeatures — feat entity-level effects", () => {
  it("carries feat.effects onto the synthesized fallback feature", () => {
    const feat = mkFeat({ effects: [{ kind: "ac-bonus", value: 1, requires_armor: true }] });
    const out = collectResolvedFeatures(null, [], null, [feat]);
    expect(out).toHaveLength(1);
    expect(out[0].feature.effects).toEqual([{ kind: "ac-bonus", value: 1, requires_armor: true }]);
    expect(out[0].source).toEqual({ kind: "feat", slug: "defense" });
  });

  it("omits the effects key when the feat has none", () => {
    const out = collectResolvedFeatures(null, [], null, [mkFeat({})]);
    expect(out[0].feature.effects).toBeUndefined();
  });

  it("merges entity effects into the first bundled feature without mutating the entity", () => {
    const bundledFeature = { name: "Defense Benefit", effects: [{ kind: "initiative-bonus", value: 1 }] };
    const feat = mkFeat({ effects: [{ kind: "ac-bonus", value: 1, requires_armor: true }] });
    (feat as unknown as { features?: unknown[] }).features = [bundledFeature, { name: "Other" }];
    const out = collectResolvedFeatures(null, [], null, [feat]);
    expect(out).toHaveLength(2);
    expect(out[0].feature.effects).toEqual([
      { kind: "initiative-bonus", value: 1 },
      { kind: "ac-bonus", value: 1, requires_armor: true },
    ]);
    expect(bundledFeature.effects).toEqual([{ kind: "initiative-bonus", value: 1 }]);
    expect(out[1].feature.effects).toBeUndefined();
  });
});

describe("collectChosenGrantedFeatures — origin (race/background) choices", () => {
  it("emits a race trait's selected select-inline branch effects as a synthesized feature", () => {
    const race = {
      slug: "srd-5e_dragonborn",
      name: "Dragonborn",
      traits: [
        {
          name: "Draconic Ancestry",
          choices: [
            {
              kind: "select-inline",
              id: "draconic-ancestry",
              count: 1,
              options: [
                { value: "black", label: "Black (Acid)", effects: [{ kind: "resistance", damage_type: "Acid" }] },
                { value: "red", label: "Red (Fire)", effects: [{ kind: "resistance", damage_type: "Fire" }] },
              ],
            },
          ],
        },
      ],
    } as never;
    const character = { class: [], origin_choices: { "race:draconic-ancestry": "red" } } as never;
    const out = collectChosenGrantedFeatures(character, [], noRegistry, race, null);
    expect(out).toHaveLength(1);
    expect(out[0].feature.effects).toEqual([{ kind: "resistance", damage_type: "Fire" }]);
    expect(out[0].source).toEqual({ kind: "race", slug: "srd-5e_dragonborn" });
  });

  it("emits nothing when no origin choice is recorded", () => {
    const race = {
      slug: "srd-5e_dragonborn",
      name: "Dragonborn",
      traits: [
        {
          name: "Draconic Ancestry",
          choices: [
            {
              kind: "select-inline",
              id: "draconic-ancestry",
              count: 1,
              options: [{ value: "red", label: "Red (Fire)", effects: [{ kind: "resistance", damage_type: "Fire" }] }],
            },
          ],
        },
      ],
    } as never;
    const character = { class: [], origin_choices: {} } as never;
    expect(collectChosenGrantedFeatures(character, [], noRegistry, race, null)).toEqual([]);
  });

  it("carries a 2014 fighting-style optional-feature's effects via the class select-entity branch", () => {
    // 2014 Defense is an optional-feature (edition 2014), selected through a class
    // fighting-style select-entity choice. This pins walkChoiceGrants's
    // select-entity branch — the only link in the chain not otherwise covered.
    const defense2014 = {
      slug: "srd-5e_defense",
      name: "Defense",
      feature_type: "fighting_style",
      description: "While you are wearing armor, you gain a +1 bonus to AC.",
      effects: [{ kind: "ac-bonus", value: 1, requires_armor: true }],
    };
    const registry = {
      getByTypeAndSlug: (type: string, slug: string) =>
        type === "optional-feature" && slug === "srd-5e_defense"
          ? { data: defense2014 }
          : undefined,
    };
    const fighter = {
      slug: "srd-5e_fighter",
      features_by_level: {
        1: [
          {
            name: "Fighting Style",
            choices: [
              {
                kind: "select-entity",
                id: "fighting-style",
                count: 1,
                entity_type: "optional-feature",
                where: { feature_type: "fighting_style", available_to: "self" },
              },
            ],
          },
        ],
      },
    };
    const classes = [{ entity: fighter, level: 1, subclass: null, choices: {} }] as never;
    const character = {
      class: [{ name: "[[srd-5e_fighter]]", level: 1, subclass: null, choices: { 1: { "fighting-style": "srd-5e_defense" } } }],
      origin_choices: {},
    } as never;
    const out = collectChosenGrantedFeatures(character, classes, registry, null, null);
    expect(out).toHaveLength(1);
    expect(out[0].feature.name).toBe("Defense");
    expect(out[0].feature.effects).toEqual([{ kind: "ac-bonus", value: 1, requires_armor: true }]);
    expect(out[0].source).toEqual({ kind: "class", slug: "srd-5e_fighter", level: 1 });
  });

  it("walks background feature choices via the background namespace", () => {
    const background = {
      slug: "srd-5e_acolyte",
      feature: {
        name: "Shelter of the Faithful",
        choices: [
          {
            kind: "select-inline",
            id: "faith-gift",
            count: 1,
            options: [{ value: "ward", label: "Ward", effects: [{ kind: "initiative-bonus", value: 1 }] }],
          },
        ],
      },
    } as never;
    const character = { class: [], origin_choices: { "background:faith-gift": "ward" } } as never;
    const out = collectChosenGrantedFeatures(character, [], noRegistry, null, background);
    expect(out).toHaveLength(1);
    expect(out[0].feature.effects).toEqual([{ kind: "initiative-bonus", value: 1 }]);
    expect(out[0].source).toEqual({ kind: "background", slug: "srd-5e_acolyte" });
  });
});
