import { describe, it, expect } from "vitest";
import { mergeOptionalFeatures } from "../../../tools/srd-canonical/merger-rules/optional-feature-merge";
import type { Overlay } from "../../../tools/srd-canonical/overlay.schema";

describe("mergeOptionalFeatures", () => {
  const overlay: Overlay = {
    optional_feature_slugs: {
      invocation: ["agonizing-blast"],
      fighting_style: ["defense"],
    },
  };

  it("filters structured-rules to overlay slug set", () => {
    const structured = [
      { name: "Agonizing Blast", source: "PHB", featureType: ["I"], entries: ["When you cast eldritch blast..."] },
      { name: "Beguiling Influence", source: "PHB", featureType: ["I"], entries: ["You learn the disguise self spell..."] },
      { name: "Defense", source: "PHB", featureType: ["FS:F", "FS:P", "FS:R"], entries: ["+1 AC while wearing armor"] },
    ];

    const result = mergeOptionalFeatures({
      edition: "2014",
      structured,
      overlay,
    });

    expect(result.length).toBe(2);
    expect(result.map(e => e.slug).sort()).toEqual(["agonizing-blast", "defense"]);
  });

  it("normalizes invocation feature_type via tag", () => {
    const structured = [
      { name: "Agonizing Blast", source: "PHB", featureType: ["I"], entries: ["text"] },
    ];
    const result = mergeOptionalFeatures({ edition: "2014", structured, overlay });
    expect(result[0].feature_type).toBe("invocation");
    expect(result[0].available_to).toContain("[[SRD 5e/warlock]]");
  });

  it("normalizes fighting style with multi-class available_to", () => {
    const structured = [
      { name: "Defense", source: "PHB", featureType: ["FS:F", "FS:P", "FS:R"], entries: ["text"] },
    ];
    const result = mergeOptionalFeatures({ edition: "2014", structured, overlay });
    expect(result[0].feature_type).toBe("fighting_style");
    expect(result[0].available_to).toEqual(
      expect.arrayContaining(["[[SRD 5e/fighter]]", "[[SRD 5e/paladin]]", "[[SRD 5e/ranger]]"])
    );
  });

  it("returns empty when overlay has no slug list", () => {
    const result = mergeOptionalFeatures({
      edition: "2014",
      structured: [{ name: "Agonizing Blast", source: "PHB", featureType: ["I"], entries: [] }],
      overlay: {},
    });
    expect(result).toEqual([]);
  });
});
