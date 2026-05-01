import { describe, it, expect } from "vitest";
import { spellInputSchema } from "../src/modules/spell/spell.ai-schema";
import type { Spell } from "../src/modules/spell/spell.types";

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

  it("accepts description with inline damage formula tags", () => {
    const result = spellInputSchema.safeParse({
      name: "Fireball", level: 3, school: "evocation", casting_time: "1 action",
      range: "150 feet", components: "V, S, M (a tiny ball of bat guano and sulfur)",
      duration: "Instantaneous",
      description: [
        "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.",
        "Each creature in a 20-foot-radius sphere must make a `dc:WIS` Dexterity saving throw. A target takes `damage:8d6` fire damage on a failed save, or half as much damage on a successful one.",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts description with dc formula tags", () => {
    const result = spellInputSchema.safeParse({
      name: "Hold Person", level: 2, school: "enchantment", casting_time: "1 action",
      range: "60 feet", components: "V, S, M (a small, straight piece of iron)",
      duration: "Concentration, up to 1 minute",
      description: [
        "Choose a humanoid that you can see within range. The target must succeed on a `dc:WIS` Wisdom saving throw or be paralyzed for the duration.",
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("Spell.casting_options runtime field", () => {
  it("Spell type accepts casting_options array", () => {
    const spell: Spell = {
      name: "Fireball",
      casting_options: [
        { type: "slot_level_4", damage_roll: "9d6" },
        { type: "slot_level_5", damage_roll: "10d6" },
      ],
    };
    expect(spell.casting_options).toBeDefined();
    expect(spell.casting_options!.length).toBe(2);
  });
});
