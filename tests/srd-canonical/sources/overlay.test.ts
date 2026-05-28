import { describe, it, expect } from "vitest";
import { loadOverlay } from "../../../tools/srd-canonical/sources/overlay";
import * as path from "node:path";

describe("loadOverlay", () => {
  it("loads and validates an overlay YAML file", async () => {
    const overlay = await loadOverlay(path.resolve(__dirname, "../fixtures/overlays/srd-5e.yaml"));
    expect(overlay.class_features?.["action-surge"]?.action_cost).toBe("special");
    expect(overlay.optional_feature_slugs?.invocation).toContain("agonizing-blast");
  });

  it("throws clear error when file missing", async () => {
    await expect(loadOverlay(path.resolve(__dirname, "../fixtures/overlays/does-not-exist.yaml")))
      .rejects.toThrow(/Overlay not found/);
  });
});
