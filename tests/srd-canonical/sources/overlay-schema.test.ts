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
