import { describe, it, expect } from "vitest";
import { collectResolvedFeatures, collectChosenGrantedFeatures } from "../src/modules/pc/pc.resolver";
import type { FeatEntity } from "../src/modules/feat/feat.types";

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
