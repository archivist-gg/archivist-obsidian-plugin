import { describe, it, expect } from "vitest";
import { durationSchema } from "@archivist/dnd5e/schemas/duration-schema";

describe("durationSchema", () => {
  it("accepts the instantaneous literal", () => {
    expect(durationSchema.safeParse("instantaneous").success).toBe(true);
  });
  it("accepts the until-dispelled literal", () => {
    expect(durationSchema.safeParse("until-dispelled").success).toBe(true);
  });
  it("accepts a structured amount + unit", () => {
    expect(durationSchema.safeParse({ amount: 1, unit: "minute" }).success).toBe(true);
  });
  it("rejects an unknown unit", () => {
    expect(durationSchema.safeParse({ amount: 1, unit: "fortnight" }).success).toBe(false);
  });
  it("rejects a non-positive amount", () => {
    expect(durationSchema.safeParse({ amount: 0, unit: "round" }).success).toBe(false);
  });
  it("rejects an unknown string literal", () => {
    expect(durationSchema.safeParse("forever").success).toBe(false);
  });
});
