import { describe, it, expect } from "vitest";
import { mergeKind, type MergeRule } from "../../tools/srd-canonical/merger";

const rule: MergeRule = {
  kind: "feat",
  pickOverlay: () => null,
};

describe("mergeKind", () => {
  it("produces one canonical entry per Open5e slug", () => {
    const result = mergeKind(rule, {
      edition: "2014",
      kind: "feat",
      open5e: [{ key: "alert", name: "Alert" }, { key: "tough", name: "Tough" }],
      structured: [{ name: "Alert", source: "PHB" }],
      activation: new Map([["alert", { activation: { type: "passive", value: 0 } }]]),
      overlay: {},
    });
    expect(result.length).toBe(2);
    expect(result.find(e => e.slug === "alert")?.activation).toBeDefined();
    expect(result.find(e => e.slug === "tough")?.activation).toBeNull();
  });

  it("matches structured by slug-from-name when no slug field", () => {
    const result = mergeKind(rule, {
      edition: "2014",
      kind: "feat",
      open5e: [{ key: "alert", name: "Alert" }],
      structured: [{ name: "Alert", source: "PHB" }],
      activation: new Map(),
      overlay: {},
    });
    expect(result[0].structured?.name).toBe("Alert");
  });

  it("returns null structured when no match", () => {
    const result = mergeKind(rule, {
      edition: "2014",
      kind: "feat",
      open5e: [{ key: "alert", name: "Alert" }],
      structured: [],
      activation: new Map(),
      overlay: {},
    });
    expect(result[0].structured).toBeNull();
  });
});
