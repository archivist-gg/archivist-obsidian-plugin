import { describe, it, expect } from "vitest";
import { featureSchema } from "@archivist-gg/dnd5e/schemas/feature-schema";

describe("featureSchema", () => {
  it("accepts name + description", () => {
    expect(featureSchema.safeParse({ name: "Fast Hands", description: "Use bonus action." }).success).toBe(true);
  });

  it("accepts name + non-empty entries", () => {
    expect(featureSchema.safeParse({ name: "Nimble Escape", entries: ["Disengage."] }).success).toBe(true);
  });

  it("rejects feature with neither description nor entries", () => {
    expect(featureSchema.safeParse({ name: "Empty" }).success).toBe(false);
  });

  it("rejects feature with empty entries and no description", () => {
    expect(featureSchema.safeParse({ name: "Empty", entries: [] }).success).toBe(false);
  });

  it("accepts feature with choices", () => {
    expect(featureSchema.safeParse({
      name: "Expertise",
      description: "...",
      choices: [{ kind: "select-proficiency", id: "expertise", domain: "skill", count: 2, from_proficient: true, expertise: true }],
    }).success).toBe(true);
  });

  it("accepts nested sub_features", () => {
    expect(featureSchema.safeParse({
      name: "Parent",
      description: "...",
      sub_features: [{ name: "Child", description: "..." }],
    }).success).toBe(true);
  });

  it("accepts consumes block", () => {
    expect(featureSchema.safeParse({
      name: "Bolster",
      description: "...",
      consumes: { source: "resource", resource: "ki", amount: 1 },
    }).success).toBe(true);
  });

  it("accepts attacks array", () => {
    expect(featureSchema.safeParse({
      name: "Psychic Blade",
      description: "...",
      attacks: [{ name: "Main", type: "melee", damage: "1d6", damage_type: "psychic" }],
    }).success).toBe(true);
  });

  it("accepts effects array", () => {
    expect(featureSchema.safeParse({
      name: "Alert",
      description: "...",
      effects: [{ kind: "initiative-bonus", value: 5 }],
    }).success).toBe(true);
  });

  it("accepts an activatable feature with a structured duration and preserves the flags", () => {
    const parsed = featureSchema.safeParse({
      id: "majesty",
      name: "Infernal Majesty",
      description: "...",
      activatable: true,
      passive: false,
      duration: { amount: 1, unit: "minute" },
      effects: [{ kind: "ac-bonus", value: 2 }],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ activatable: true, passive: false, duration: { amount: 1, unit: "minute" } });
  });

  it("still accepts a plain feature with no activatable/duration flags", () => {
    expect(featureSchema.safeParse({ name: "Fast Hands", description: "Use bonus action." }).success).toBe(true);
  });
});
