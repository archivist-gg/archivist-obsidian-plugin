import { describe, it, expect } from "vitest";
import { spellInputSchema } from "../src/ai/schemas/spell-schema";

describe("spellInputSchema", () => {
  it("validates a valid spell", () => {
    const result = spellInputSchema.safeParse({
      name: "Fireball", level: 3, school: "evocation", casting_time: "1 action",
      range: "150 feet", components: "V, S, M (a tiny ball of bat guano and sulfur)",
      duration: "Instantaneous", description: ["A bright streak flashes from your pointing finger."],
    });
    expect(result.success).toBe(true);
  });
  it("rejects level above 9", () => {
    const result = spellInputSchema.safeParse({
      name: "Test", level: 10, school: "evocation", casting_time: "1 action",
      range: "Self", components: "V", duration: "Instantaneous", description: ["Test"],
    });
    expect(result.success).toBe(false);
  });
  it("rejects invalid school", () => {
    const result = spellInputSchema.safeParse({
      name: "Test", level: 1, school: "pyromancy", casting_time: "1 action",
      range: "Self", components: "V", duration: "Instantaneous", description: ["Test"],
    });
    expect(result.success).toBe(false);
  });
});
