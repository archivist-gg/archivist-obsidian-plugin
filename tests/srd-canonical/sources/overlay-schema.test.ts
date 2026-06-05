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
