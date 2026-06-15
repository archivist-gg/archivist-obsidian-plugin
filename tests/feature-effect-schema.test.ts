import { describe, it, expect } from "vitest";
import { featureEffectSchema } from "../src/shared/schemas/feature-effect-schema";

describe("featureEffectSchema — ac-bonus", () => {
  it("accepts ac-bonus with requires_armor", () => {
    expect(featureEffectSchema.safeParse({ kind: "ac-bonus", value: 1, requires_armor: true }).success).toBe(true);
  });

  it("accepts ac-bonus without requires_armor", () => {
    expect(featureEffectSchema.safeParse({ kind: "ac-bonus", value: 2 }).success).toBe(true);
  });

  it("rejects ac-bonus with non-integer value", () => {
    expect(featureEffectSchema.safeParse({ kind: "ac-bonus", value: 1.5 }).success).toBe(false);
  });

  it("rejects ac-bonus missing value", () => {
    expect(featureEffectSchema.safeParse({ kind: "ac-bonus" }).success).toBe(false);
  });

  it("still accepts the existing kinds (regression)", () => {
    expect(featureEffectSchema.safeParse({ kind: "resistance", damage_type: "Fire" }).success).toBe(true);
  });
});

describe("featureEffectSchema — sense (replaces darkvision)", () => {
  it("accepts each sense type with a range", () => {
    for (const type of ["darkvision", "blindsight", "tremorsense", "truesight"] as const) {
      expect(featureEffectSchema.safeParse({ kind: "sense", type, range: 60 }).success).toBe(true);
    }
  });
  it("rejects an unknown sense type", () => {
    expect(featureEffectSchema.safeParse({ kind: "sense", type: "x-ray", range: 60 }).success).toBe(false);
  });
  it("no longer accepts the removed darkvision kind", () => {
    expect(featureEffectSchema.safeParse({ kind: "darkvision", range: 60 }).success).toBe(false);
  });
});
