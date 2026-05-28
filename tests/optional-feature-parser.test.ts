import { describe, it, expect } from "vitest";
import { parseOptionalFeature } from "../src/modules/optional-feature/optional-feature.parser";

describe("parseOptionalFeature", () => {
  it("parses a valid YAML block", () => {
    const yaml = `
slug: agonizing-blast
name: Agonizing Blast
edition: '2014'
source: SRD 5.1
feature_type: invocation
description: When you cast eldritch blast, add Charisma to damage.
prerequisites:
  - kind: spell-known
    spell: '[[SRD 5e/eldritch-blast]]'
available_to:
  - '[[SRD 5e/warlock]]'
effects: []
`.trim();
    const result = parseOptionalFeature(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feature_type).toBe("invocation");
      expect(result.data.available_to).toEqual(["[[SRD 5e/warlock]]"]);
    }
  });

  it("returns error on missing required field", () => {
    const yaml = "name: Bare\n";
    const result = parseOptionalFeature(yaml);
    expect(result.success).toBe(false);
  });
});
