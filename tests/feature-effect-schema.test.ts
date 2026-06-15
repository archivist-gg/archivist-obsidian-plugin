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

describe("featureEffectSchema — unarmored-ac", () => {
  it("accepts unarmored-ac with abilities, base and allow_shield", () => {
    expect(featureEffectSchema.safeParse({ kind: "unarmored-ac", abilities: ["cha"], base: 10, allow_shield: true }).success).toBe(true);
  });
  it("accepts unarmored-ac with empty abilities (e.g. base 13)", () => {
    expect(featureEffectSchema.safeParse({ kind: "unarmored-ac", abilities: [], base: 13 }).success).toBe(true);
  });
});

describe("featureEffectSchema — weapon-ability", () => {
  it("accepts weapon-ability with ability and weapon scope", () => {
    expect(featureEffectSchema.safeParse({ kind: "weapon-ability", ability: "cha", weapons: "chosen" }).success).toBe(true);
    expect(featureEffectSchema.safeParse({ kind: "weapon-ability", ability: "spellcasting" }).success).toBe(true);
  });
});

describe("featureEffectSchema — roll-modifier", () => {
  it("accepts roll-modifier with scope (ability-check, no condition)", () => {
    expect(featureEffectSchema.safeParse({
      kind: "roll-modifier", mode: "advantage", roll: "ability-check", scope: "deception",
    }).success).toBe(true);
  });

  it("accepts roll-modifier with condition (attack, no scope)", () => {
    expect(featureEffectSchema.safeParse({
      kind: "roll-modifier", mode: "disadvantage", roll: "attack", condition: "in dim light or darkness",
    }).success).toBe(true);
  });

  it("accepts roll-modifier with neither scope nor condition (saving-throw)", () => {
    expect(featureEffectSchema.safeParse({
      kind: "roll-modifier", mode: "advantage", roll: "saving-throw",
    }).success).toBe(true);
  });

  it("accepts roll-modifier with both scope and condition", () => {
    expect(featureEffectSchema.safeParse({
      kind: "roll-modifier", mode: "advantage", roll: "ability-check", scope: "stealth", condition: "while in dim light",
    }).success).toBe(true);
  });

  it("rejects an unknown mode", () => {
    expect(featureEffectSchema.safeParse({
      kind: "roll-modifier", mode: "super", roll: "attack",
    }).success).toBe(false);
  });

  it("rejects an unknown roll type", () => {
    expect(featureEffectSchema.safeParse({
      kind: "roll-modifier", mode: "advantage", roll: "initiative",
    }).success).toBe(false);
  });
});
