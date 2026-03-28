import { describe, it, expect } from "vitest";
import { encounterInputSchema, encounterOutputSchema } from "../src/ai/schemas/encounter-schema";

describe("encounterInputSchema", () => {
  it("validates valid encounter input", () => {
    const result = encounterInputSchema.safeParse({ party_size: 4, party_level: 5, difficulty: "medium", environment: "forest" });
    expect(result.success).toBe(true);
  });
  it("rejects invalid difficulty", () => {
    const result = encounterInputSchema.safeParse({ party_size: 4, party_level: 5, difficulty: "impossible" });
    expect(result.success).toBe(false);
  });
});
describe("encounterOutputSchema", () => {
  it("validates valid encounter output", () => {
    const result = encounterOutputSchema.safeParse({
      monsters: [{ name: "Goblin", cr: "1/4", count: 6, role: "minion" }],
      tactics: "Hit-and-run.", terrain: "Dense forest.", notes: "Add boss if strong.",
      xp_budget: { target: 500, actual: 450, difficulty_rating: "medium" },
    });
    expect(result.success).toBe(true);
  });
});
