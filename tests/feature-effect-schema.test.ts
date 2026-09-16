import { describe, it, expect } from "vitest";
import { featureEffectSchema } from "@archivist-gg/dnd5e/schemas/feature-effect-schema";
import type { FeatureEffect } from "@archivist-gg/dnd5e/types/feature-effect";

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

describe("featureEffectSchema — extra-attack", () => {
  it("accepts extra-attack with count 1", () => {
    expect(featureEffectSchema.safeParse({ kind: "extra-attack", count: 1 }).success).toBe(true);
  });

  it("rejects extra-attack with count 0 (not positive)", () => {
    expect(featureEffectSchema.safeParse({ kind: "extra-attack", count: 0 }).success).toBe(false);
  });

  it("rejects extra-attack with a non-integer count", () => {
    expect(featureEffectSchema.safeParse({ kind: "extra-attack", count: 1.5 }).success).toBe(false);
  });
});

describe("featureEffectSchema — crit-range", () => {
  it("accepts crit-range with min_roll 19", () => {
    expect(featureEffectSchema.safeParse({ kind: "crit-range", min_roll: 19 }).success).toBe(true);
  });

  it("accepts crit-range with applies_to and condition", () => {
    expect(featureEffectSchema.safeParse({
      kind: "crit-range", min_roll: 18, applies_to: "weapon", condition: "while raging",
    }).success).toBe(true);
    expect(featureEffectSchema.safeParse({ kind: "crit-range", min_roll: 19, applies_to: "spell" }).success).toBe(true);
    expect(featureEffectSchema.safeParse({ kind: "crit-range", min_roll: 19, applies_to: "all" }).success).toBe(true);
  });

  it("rejects min_roll below 2", () => {
    expect(featureEffectSchema.safeParse({ kind: "crit-range", min_roll: 1 }).success).toBe(false);
  });

  it("rejects min_roll above 20", () => {
    expect(featureEffectSchema.safeParse({ kind: "crit-range", min_roll: 21 }).success).toBe(false);
  });

  it("rejects an unknown applies_to", () => {
    expect(featureEffectSchema.safeParse({ kind: "crit-range", min_roll: 19, applies_to: "ranged" }).success).toBe(false);
  });
});

describe("featureEffectSchema — reroll-damage", () => {
  it("accepts reroll-damage with just max_reroll", () => {
    expect(featureEffectSchema.safeParse({ kind: "reroll-damage", max_reroll: 2 }).success).toBe(true);
  });

  it("accepts reroll-damage with optional applies_to and once_per_die", () => {
    expect(featureEffectSchema.safeParse({
      kind: "reroll-damage", max_reroll: 1, applies_to: "weapon", once_per_die: true,
    }).success).toBe(true);
    expect(featureEffectSchema.safeParse({ kind: "reroll-damage", max_reroll: 2, applies_to: "spell" }).success).toBe(true);
    expect(featureEffectSchema.safeParse({ kind: "reroll-damage", max_reroll: 2, applies_to: "all" }).success).toBe(true);
  });

  it("rejects reroll-damage with max_reroll 0 (not positive)", () => {
    expect(featureEffectSchema.safeParse({ kind: "reroll-damage", max_reroll: 0 }).success).toBe(false);
  });

  it("rejects reroll-damage with a non-integer max_reroll", () => {
    expect(featureEffectSchema.safeParse({ kind: "reroll-damage", max_reroll: 1.5 }).success).toBe(false);
  });

  it("rejects reroll-damage with an unknown applies_to", () => {
    expect(featureEffectSchema.safeParse({ kind: "reroll-damage", max_reroll: 2, applies_to: "ranged" }).success).toBe(false);
  });
});

describe("featureEffectSchema — attack-rule", () => {
  it("accepts attack-rule with the no-ranged-in-melee-disadvantage flag", () => {
    expect(featureEffectSchema.safeParse({ kind: "attack-rule", flag: "no-ranged-in-melee-disadvantage" }).success).toBe(true);
  });

  it("rejects attack-rule with an unknown flag", () => {
    expect(featureEffectSchema.safeParse({ kind: "attack-rule", flag: "fly-faster" }).success).toBe(false);
  });

  it("rejects attack-rule missing the flag", () => {
    expect(featureEffectSchema.safeParse({ kind: "attack-rule" }).success).toBe(false);
  });
});

describe("featureEffectSchema — proficiency armor/weapon", () => {
  it("accepts proficiency with armor type", () => {
    expect(featureEffectSchema.safeParse({ kind: "proficiency", proficiency_type: "armor", value: "heavy" }).success).toBe(true);
  });

  it("accepts proficiency with weapon type", () => {
    expect(featureEffectSchema.safeParse({ kind: "proficiency", proficiency_type: "weapon", value: "longsword" }).success).toBe(true);
  });

  it("still accepts the original proficiency types (regression)", () => {
    for (const proficiency_type of ["skill", "tool", "language", "saving-throw"] as const) {
      expect(featureEffectSchema.safeParse({ kind: "proficiency", proficiency_type, value: "x" }).success).toBe(true);
    }
  });

  it("rejects an unknown proficiency type", () => {
    expect(featureEffectSchema.safeParse({ kind: "proficiency", proficiency_type: "feat", value: "x" }).success).toBe(false);
  });
});

describe("featureEffectSchema — damage-bonus scoping", () => {
  it("accepts damage-bonus with applies_to, condition, and damage_type 'chosen'", () => {
    expect(featureEffectSchema.safeParse({
      kind: "damage-bonus", damage_type: "chosen", amount: "1d6", applies_to: "weapon", condition: "while raging",
    }).success).toBe(true);
  });

  it("accepts each applies_to scope", () => {
    for (const applies_to of ["weapon", "spell", "all"] as const) {
      expect(featureEffectSchema.safeParse({ kind: "damage-bonus", damage_type: "fire", amount: "1d6", applies_to }).success).toBe(true);
    }
  });

  it("still accepts the minimal damage-bonus (regression)", () => {
    expect(featureEffectSchema.safeParse({ kind: "damage-bonus", damage_type: "fire", amount: "1d6" }).success).toBe(true);
  });

  it("rejects an unknown applies_to", () => {
    expect(featureEffectSchema.safeParse({ kind: "damage-bonus", damage_type: "fire", amount: "1d6", applies_to: "ranged" }).success).toBe(false);
  });
});

describe("featureEffectSchema — speed-bonus set", () => {
  it("accepts speed-bonus with set true", () => {
    expect(featureEffectSchema.safeParse({ kind: "speed-bonus", mode: "walk", value: 60, set: true }).success).toBe(true);
  });

  it("still accepts speed-bonus without set (additive, regression)", () => {
    expect(featureEffectSchema.safeParse({ kind: "speed-bonus", mode: "walk", value: 10 }).success).toBe(true);
  });

  it("rejects a non-boolean set", () => {
    expect(featureEffectSchema.safeParse({ kind: "speed-bonus", mode: "walk", value: 60, set: "yes" }).success).toBe(false);
  });
});

const KINDS_26 = [
  "initiative-bonus", "immune-condition", "resistance", "hp-per-level-bonus", "speed-bonus", "attunement-limit", "sense",
  "apply-condition", "damage-bonus", "proficiency", "ac-bonus", "unarmored-ac", "unarmed-strike", "weapon-ability", "roll-modifier",
  "extra-attack", "crit-range", "reroll-damage", "attack-rule",
  "immunity", "vulnerability", "temp-hp", "heal", "ability-score-increase", "extra-action", "save-outcome",
] as const;

describe("featureEffectSchema · the 26-arm union (R4-G1a D1, G1; R4-G6b §5.2)", () => {
  it("declares exactly the 26 kinds, in order", () => {
    const kinds = featureEffectSchema.options.map((o) => (o.shape.kind as { value: string }).value);
    expect(kinds).toEqual([...KINDS_26]);
  });
  it("every arm declares subject; every arm but the two condition-name arms declares the condition qualifier; proficiency declares expertise (G5)", () => {
    for (const o of featureEffectSchema.options) {
      const kind = (o.shape.kind as { value: string }).value;
      const keys = Object.keys(o.shape);
      expect(keys, kind).toContain("subject");
      if (kind !== "apply-condition" && kind !== "immune-condition") expect(keys, kind).toContain("condition");
      if (kind === "proficiency") expect(keys).toContain("expertise");
    }
  });
  it("subject and condition SURVIVE parsing on the arms the corpus emits them on (G5 output-read)", () => {
    const samples: Record<string, unknown>[] = [
      { kind: "damage-bonus", damage_type: "Fire", amount: "1d6", subject: "self" },
      { kind: "resistance", damage_type: "Poison", subject: "self", condition: "While raging" },
      { kind: "temp-hp", amount: "your Artificer level", subject: "self", condition: "While *Bloodied*" },
      { kind: "immunity", damage_type: "necrotic", subject: "self", condition: "While using your Form of Dread" },
      { kind: "proficiency", proficiency_type: "skill", value: "Athletics", subject: "self", expertise: true },
      { kind: "sense", type: "darkvision", range: 60, subject: "self", condition: "while in dim light" },
      { kind: "extra-attack", count: 1, subject: "self" },
      { kind: "immune-condition", condition: "frightened", while: "while raging", subject: "self" },
      { kind: "vulnerability", damage_type: "radiant", subject: "self" },
      { kind: "initiative-bonus", value: 2, subject: "self" },
      { kind: "reroll-damage", max_reroll: 2, subject: "self" },
      { kind: "attack-rule", flag: "no-ranged-in-melee-disadvantage", subject: "self" },
    ];
    for (const s of samples) expect(featureEffectSchema.parse(s), String(s.kind)).toEqual(s);
  });
  it("subject must be non-empty when present", () => {
    expect(featureEffectSchema.safeParse({ kind: "resistance", damage_type: "Fire", subject: "" }).success).toBe(false);
  });
  it("roll-modifier accepts all eight members (G4)", () => {
    for (const mode of ["advantage", "disadvantage", "reroll", "add-d4"])
      for (const roll of ["ability-check", "saving-throw", "attack", "any"])
        expect(featureEffectSchema.safeParse({ kind: "roll-modifier", mode, roll }).success, `${mode}/${roll}`).toBe(true);
    expect(featureEffectSchema.safeParse({ kind: "roll-modifier", mode: "auto-fail", roll: "attack" }).success).toBe(false);
  });
  it("ability-score-increase: choose is required IFF abilities is chosen (G3)", () => {
    const ok = (o: object) => featureEffectSchema.safeParse({ kind: "ability-score-increase", amount: 2, max: 20, ...o }).success;
    expect(ok({ abilities: "chosen", choose: 1 })).toBe(true);
    expect(ok({ abilities: "chosen", choose: null })).toBe(false);
    expect(ok({ abilities: ["str", "con"], amount: 4, choose: null, max: 24 })).toBe(true);
    expect(ok({ abilities: ["dex", "wis"], amount: 4, choose: null, max: 25 })).toBe(true);
    expect(ok({ abilities: ["str", "con"], choose: 1 })).toBe(false);
  });
  it("the seven new arms parse their attested shapes", () => {
    const ok = (o: object) => featureEffectSchema.safeParse(o).success;
    expect(ok({ kind: "heal", amount: "1d10", subject: "self" })).toBe(true);
    expect(ok({ kind: "temp-hp", amount: "2d4 + 2", subject: "self" })).toBe(true);
    expect(ok({ kind: "extra-action", count: 1, action_type: "bonus-action", subject: "self", condition: "used only to take the Dash action" })).toBe(true);
    expect(ok({ kind: "save-outcome", ability: "dex", on_success: "none", on_failure: "half", applies_to: null, subject: "self" })).toBe(true);
    expect(ok({ kind: "heal", subject: "self" })).toBe(false);
  });
});

// Compile-time twin of the runtime pin (spec D8): the union's discriminators and the hand-written type agree.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _kindsAgree: Equals<FeatureEffect["kind"], (typeof KINDS_26)[number]> = true;
void _kindsAgree;
