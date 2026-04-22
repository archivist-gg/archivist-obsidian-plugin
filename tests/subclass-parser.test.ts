import { describe, it, expect } from "vitest";
import { parseSubclass } from "../src/modules/subclass/subclass.parser";

const yaml = `
slug: thief
name: Thief
parent_class: "[[rogue]]"
edition: "2014"
source: "SRD 5.1"
description: Burglar.
features_by_level:
  "3":
    - { name: "Fast Hands", description: "Use bonus action." }
resources: []
`;

describe("parseSubclass", () => {
  it("parses a valid subclass", () => {
    const result = parseSubclass(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("thief");
      expect(result.data.parent_class).toBe("[[rogue]]");
    }
  });

  it("rejects missing parent_class", () => {
    expect(parseSubclass(`slug: thief\nname: Thief`).success).toBe(false);
  });
});
