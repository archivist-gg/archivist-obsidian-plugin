import { describe, it, expect } from "vitest";
import { mergeKind } from "../../tools/srd-canonical/merger";
import { raceMergeRule, toRaceCanonical } from "../../tools/srd-canonical/merger-rules/race-merge";
import { featMergeRule, toFeatCanonical } from "../../tools/srd-canonical/merger-rules/feat-merge";
import { mergeOptionalFeatures } from "../../tools/srd-canonical/merger-rules/optional-feature-merge";
import { rewriteCrossRefs } from "../../tools/srd-canonical/cross-ref-map";
import { projectToRuntime } from "../../tools/srd-canonical/to-runtime";

describe("pipeline integration", () => {
  it("races: Dwarf flows from Open5e → CanonicalEntry → RaceCanonical → runtime projection", () => {
    const open5e = [{
      key: "dwarf",
      name: "Dwarf",
      desc: "Stout and hardy.",
      size: "Medium",
      speed: { walk: 25 },
      traits: [{ name: "Darkvision", desc: "60 feet." }],
    }];
    const merged = mergeKind(raceMergeRule, {
      edition: "2014",
      kind: "race",
      open5e,
      structured: [],
      activation: new Map(),
      overlay: {},
    });
    expect(merged.length).toBe(1);

    const canonical = toRaceCanonical(merged[0]);
    expect(canonical.slug).toBe("srd-5e_dwarf");
    expect(canonical.size).toBe("medium");
    expect(canonical.traits[0].name).toBe("Darkvision");

    const runtime = projectToRuntime("race", canonical as unknown as Record<string, unknown>);
    expect(runtime.slug).toBe("srd-5e_dwarf");
    expect(runtime.traits).toBeDefined();
  });

  it("feats: Alert flows through pipeline with overlay-driven action_cost (no overlay applied for feats)", () => {
    const open5e = [{
      key: "alert",
      name: "Alert",
      desc: "Always on watch.",
      type: "General",
      benefits: [{ desc: "+5 to initiative" }],
    }];
    const merged = mergeKind(featMergeRule, {
      edition: "2014",
      kind: "feat",
      open5e,
      structured: [{ name: "Alert", source: "PHB", _isRepeatable: false }],
      activation: new Map(),
      overlay: {},
    });
    const canonical = toFeatCanonical(merged[0]);
    expect(canonical.slug).toBe("srd-5e_alert");
    expect(canonical.benefits).toContain("+5 to initiative");
  });

  it("optional-features: Agonizing Blast flows through structured-rules → overlay slug filter → normalizer", () => {
    const merged = mergeOptionalFeatures({
      edition: "2014",
      structured: [
        { name: "Agonizing Blast", source: "PHB", featureType: ["I"], entries: ["When you cast eldritch blast, add Charisma to damage."] },
        { name: "Beguiling Influence", source: "PHB", featureType: ["I"], entries: ["You learn the disguise self spell..."] },
      ],
      overlay: { optional_feature_slugs: { invocation: ["agonizing-blast"] } },
    });
    expect(merged.length).toBe(1);
    expect(merged[0].slug).toBe("srd-5e_agonizing-blast");
    expect(merged[0].feature_type).toBe("invocation");
    expect(merged[0].available_to).toContain("[[SRD 5e/warlock]]");
  });

  it("cross-ref rewriting: source markers → wikilinks (2014 vs 2024 compendium)", () => {
    expect(rewriteCrossRefs("Cast {@spell fireball}.", "2014")).toBe("Cast [[SRD 5e/Spells/Fireball|fireball]].");
    expect(rewriteCrossRefs("Cast {@spell fireball}.", "2024")).toBe("Cast [[SRD 2024/Spells/Fireball|fireball]].");
  });
});
