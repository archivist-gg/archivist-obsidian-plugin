import { describe, it, expect } from "vitest";
import { choiceSchema } from "../src/shared/schemas/choice-schema";

describe("choiceSchema", () => {
  it("accepts a skill choice with count and pool", () => {
    const result = choiceSchema.safeParse({ kind: "skill", count: 2, from: ["stealth", "deception"] });
    expect(result.success).toBe(true);
  });

  it("accepts a skill choice without explicit pool", () => {
    expect(choiceSchema.safeParse({ kind: "skill", count: 4 }).success).toBe(true);
  });

  it("rejects a skill choice with non-integer count", () => {
    expect(choiceSchema.safeParse({ kind: "skill", count: 1.5 }).success).toBe(false);
  });

  it("rejects a skill choice with invalid skill slug", () => {
    expect(choiceSchema.safeParse({ kind: "skill", count: 1, from: ["mythic-skill"] }).success).toBe(false);
  });

  it("accepts a feat choice with optional category", () => {
    expect(choiceSchema.safeParse({ kind: "feat", category: "origin" }).success).toBe(true);
  });

  it("accepts an asi choice", () => {
    expect(choiceSchema.safeParse({ kind: "asi" }).success).toBe(true);
  });

  it("accepts an ability-score choice", () => {
    expect(choiceSchema.safeParse({ kind: "ability-score", count: 2, pool: ["str", "dex"], each: 1 }).success).toBe(true);
  });

  it("accepts a fighting-style choice", () => {
    expect(choiceSchema.safeParse({ kind: "fighting-style", from: ["defense", "dueling"] }).success).toBe(true);
  });

  it("rejects a fighting-style with empty from", () => {
    expect(choiceSchema.safeParse({ kind: "fighting-style", from: [] }).success).toBe(false);
  });

  it("rejects unknown kind", () => {
    expect(choiceSchema.safeParse({ kind: "wibble", count: 1 }).success).toBe(false);
  });
});
