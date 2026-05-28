import { describe, it, expect } from "vitest";
import { parseFeat } from "../src/modules/feat/feat.parser";

const yaml = `
slug: alert
name: Alert
edition: "2014"
source: "SRD 5.1"
category: general
description: "Always on the lookout."
prerequisites: []
benefits: ["You can't be surprised while you are conscious."]
effects:
  - { kind: "initiative-bonus", value: 5 }
grants_asi: null
repeatable: false
choices: []
`;

describe("parseFeat", () => {
  it("parses a valid feat", () => {
    const result = parseFeat(yaml);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe("alert");
  });

  it("rejects invalid category", () => {
    const bad = yaml.replace("category: general", "category: boon");
    expect(parseFeat(bad).success).toBe(false);
  });
});
