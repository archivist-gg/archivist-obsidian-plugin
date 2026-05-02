import { describe, it, expect } from "vitest";
import { mergeKind } from "../../tools/srd-canonical/merger";
import { raceMergeRule, toRaceCanonical } from "../../tools/srd-canonical/merger-rules/race-merge";
import { featMergeRule, toFeatCanonical } from "../../tools/srd-canonical/merger-rules/feat-merge";
import { mergeOptionalFeatures } from "../../tools/srd-canonical/merger-rules/optional-feature-merge";
import { rewriteCrossRefs } from "../../tools/srd-canonical/cross-ref-map";
import { projectToRuntime } from "../../tools/srd-canonical/to-runtime";
import { expandVariants, type BaseItem, type VariantRule } from "../../tools/srd-canonical/expand-variants";
import { slugifyName } from "../../tools/srd-canonical/sources/slug-normalize";

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

  // Variant-pipeline dedup against Open5e canonical-name slugs (I5).
  //
  // The dedup logic itself lives in tools/srd-canonical/index.ts:main(): after
  // the Open5e magicitems merge produces canonical entries with names like
  // "Flame Tongue (Longsword)", the variant pipeline emits parallel entries
  // ("Flame Tongue Longsword") that slugify to the same key. The Open5e form
  // wins; the variant copy is dropped.
  //
  // These tests build a synthetic Open5e slug set + run expandVariants over
  // a small fixture, then mirror the filter index.ts applies. That keeps the
  // assertion fast and deterministic without depending on the structured-rules
  // dump on disk.
  describe("variant pipeline dedup vs Open5e canonical-name slugs (I5)", () => {
    function dedup(
      expanded: ReturnType<typeof expandVariants>,
      open5eNameSlugs: Set<string>,
    ): ReturnType<typeof expandVariants> {
      return expanded.filter(e => !open5eNameSlugs.has(slugifyName(e.name)));
    }

    it("dedup: bundle does not contain both 'Flame Tongue (Longsword)' and 'Flame Tongue Longsword'", () => {
      // Open5e canonical magic items already include a per-base entry.
      const open5eItems = [
        { name: "Flame Tongue (Longsword)" },
        { name: "Flame Tongue (Greatsword)" },
      ];
      const open5eNameSlugs = new Set(open5eItems.map(c => slugifyName(c.name)));

      // Variant pipeline expansion yields the parallel "Flame Tongue Longsword".
      const bases: BaseItem[] = [
        { name: "Longsword", slug: "longsword", base_item_type: "weapon", sword: true },
        { name: "Greatsword", slug: "greatsword", base_item_type: "weapon", sword: true },
      ];
      const variants: VariantRule[] = [
        {
          name: "Flame Tongue",
          type: "GV",
          requires: [{ sword: true }],
          inherits: { namePrefix: "Flame Tongue ", rarity: "rare", reqAttune: true },
        },
      ];
      const expanded = expandVariants(bases, variants, "2014");
      const filtered = dedup(expanded, open5eNameSlugs);

      // Simulate the bundle: Open5e items + filtered variant items.
      const allItems = [
        ...open5eItems.map(o => ({ name: o.name })),
        ...filtered.map(e => ({ name: e.name })),
      ];

      const flameTongues = allItems.filter(i => slugifyName(i.name) === "flame-tongue-longsword");
      expect(flameTongues).toHaveLength(1);
      const names = new Set(allItems.map(i => i.name));
      // Open5e form (with parens) wins per the spec.
      expect(names).toContain("Flame Tongue (Longsword)");
      expect(names).not.toContain("Flame Tongue Longsword");
    });

    it("dedup: variant pipeline still emits items Open5e doesn't have", () => {
      // Open5e has no "Vicious *" entries.
      const open5eItems = [{ name: "Flame Tongue (Longsword)" }];
      const open5eNameSlugs = new Set(open5eItems.map(c => slugifyName(c.name)));

      const bases: BaseItem[] = [
        { name: "Mace", slug: "mace", base_item_type: "weapon" },
      ];
      const variants: VariantRule[] = [
        {
          name: "Vicious",
          type: "GV",
          requires: [{ weapon: true }],
          inherits: { namePrefix: "Vicious ", rarity: "rare" },
        },
      ];
      const expanded = expandVariants(bases, variants, "2014");
      const filtered = dedup(expanded, open5eNameSlugs);

      const viciousMace = filtered.find(i => slugifyName(i.name) === "vicious-mace");
      expect(viciousMace).toBeDefined();
    });
  });
});
