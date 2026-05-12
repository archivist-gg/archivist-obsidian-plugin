import { describe, it, expect } from "vitest";
import { computeConditionEffects } from "../src/modules/pc/pc.conditions";
import type { CharacterState, ConditionEffects } from "../src/modules/pc/pc.types";
import type { Ability } from "../src/shared/types";

const ZERO_SCORES: Record<Ability, number> = {
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
};

function stateWith(conditions: string[] = [], exhaustion = 0): CharacterState {
  return {
    hp: { current: 10, max: 10, temp: 0 },
    hit_dice: {},
    spell_slots: {},
    concentration: null,
    conditions: conditions as never,
    exhaustion,
    inspiration: 0,
    feature_uses: {},
  };
}

describe("computeConditionEffects — empty state", () => {
  it("returns zero-effects when no conditions and exhaustion 0", () => {
    const out = computeConditionEffects(stateWith(), "2014", ZERO_SCORES);
    expect(out.speed_multiplier).toBe(1);
    expect(out.speed_reduction_ft).toBe(0);
    expect(out.speed_floor_zero).toBe(false);
    expect(out.hp_max_multiplier).toBe(1);
    expect(out.d20_test_penalty).toBe(0);
    expect(out.exhaustion_level).toBe(0);
    expect(out.attack_disadvantage).toBe(false);
    expect(out.attack_advantage).toBe(false);
    expect(out.actions_disabled).toBe(false);
    expect(out.sources).toEqual([]);
  });
});

describe("computeConditionEffects — 2014 individual conditions", () => {
  it("Blinded: attack_disadvantage + attack_advantage_against", () => {
    const out = computeConditionEffects(stateWith(["blinded"]), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(true);
    expect(out.attack_advantage_against).toBe(true);
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0].condition).toBe("blinded");
  });
  it("Charmed: no flags, only tooltip", () => {
    const out = computeConditionEffects(stateWith(["charmed"]), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(false);
    expect(out.actions_disabled).toBe(false);
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0].effects.length).toBeGreaterThan(0);
  });
  it("Deafened: no flags, only tooltip", () => {
    const out = computeConditionEffects(stateWith(["deafened"]), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(false);
    expect(out.sources).toHaveLength(1);
  });
  it("Frightened: attack_disadvantage + ability_check_disadvantage", () => {
    const out = computeConditionEffects(stateWith(["frightened"]), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(true);
    expect(out.ability_check_disadvantage).toBe(true);
  });
  it("Grappled: speed_floor_zero", () => {
    const out = computeConditionEffects(stateWith(["grappled"]), "2014", ZERO_SCORES);
    expect(out.speed_floor_zero).toBe(true);
    expect(out.attack_disadvantage).toBe(false);
  });
  it("Incapacitated: actions and reactions disabled", () => {
    const out = computeConditionEffects(stateWith(["incapacitated"]), "2014", ZERO_SCORES);
    expect(out.actions_disabled).toBe(true);
    expect(out.reactions_disabled).toBe(true);
  });
  it("Invisible: attack_advantage", () => {
    const out = computeConditionEffects(stateWith(["invisible"]), "2014", ZERO_SCORES);
    expect(out.attack_advantage).toBe(true);
    expect(out.attack_disadvantage).toBe(false);
  });
  it("Paralyzed: incapacitated + speed 0 + autofail STR/DEX + adv vs", () => {
    const out = computeConditionEffects(stateWith(["paralyzed"]), "2014", ZERO_SCORES);
    expect(out.actions_disabled).toBe(true);
    expect(out.reactions_disabled).toBe(true);
    expect(out.speed_floor_zero).toBe(true);
    expect(out.save_autofail_str).toBe(true);
    expect(out.save_autofail_dex).toBe(true);
    expect(out.attack_advantage_against).toBe(true);
  });
  it("Petrified: same flags as Paralyzed", () => {
    const out = computeConditionEffects(stateWith(["petrified"]), "2014", ZERO_SCORES);
    expect(out.actions_disabled).toBe(true);
    expect(out.speed_floor_zero).toBe(true);
    expect(out.save_autofail_str).toBe(true);
    expect(out.save_autofail_dex).toBe(true);
  });
  it("Poisoned: attack_disadvantage + ability_check_disadvantage", () => {
    const out = computeConditionEffects(stateWith(["poisoned"]), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(true);
    expect(out.ability_check_disadvantage).toBe(true);
  });
  it("Prone: attack_disadvantage", () => {
    const out = computeConditionEffects(stateWith(["prone"]), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(true);
  });
  it("Restrained: speed 0 + dis attacks + adv vs + dis DEX saves", () => {
    const out = computeConditionEffects(stateWith(["restrained"]), "2014", ZERO_SCORES);
    expect(out.speed_floor_zero).toBe(true);
    expect(out.attack_disadvantage).toBe(true);
    expect(out.attack_advantage_against).toBe(true);
    expect(out.save_disadvantage_dex).toBe(true);
  });
  it("Stunned: incapacitated + autofail STR/DEX + adv vs", () => {
    const out = computeConditionEffects(stateWith(["stunned"]), "2014", ZERO_SCORES);
    expect(out.actions_disabled).toBe(true);
    expect(out.save_autofail_str).toBe(true);
    expect(out.save_autofail_dex).toBe(true);
    expect(out.attack_advantage_against).toBe(true);
  });
  it("Unconscious: incapacitated + speed 0 + autofail + adv vs", () => {
    const out = computeConditionEffects(stateWith(["unconscious"]), "2014", ZERO_SCORES);
    expect(out.actions_disabled).toBe(true);
    expect(out.speed_floor_zero).toBe(true);
    expect(out.save_autofail_str).toBe(true);
    expect(out.attack_advantage_against).toBe(true);
  });
});

describe("computeConditionEffects — 2024 condition deltas", () => {
  it("Grappled (2024): adds attack_disadvantage", () => {
    const out2024 = computeConditionEffects(stateWith(["grappled"]), "2024", ZERO_SCORES);
    expect(out2024.speed_floor_zero).toBe(true);
    expect(out2024.attack_disadvantage).toBe(true);
  });
  it("Grappled (2014): no attack_disadvantage", () => {
    const out2014 = computeConditionEffects(stateWith(["grappled"]), "2014", ZERO_SCORES);
    expect(out2014.attack_disadvantage).toBe(false);
  });
  it("Frightened (2024): same flags as 2014", () => {
    const out2014 = computeConditionEffects(stateWith(["frightened"]), "2014", ZERO_SCORES);
    const out2024 = computeConditionEffects(stateWith(["frightened"]), "2024", ZERO_SCORES);
    expect(out2024.attack_disadvantage).toBe(out2014.attack_disadvantage);
    expect(out2024.ability_check_disadvantage).toBe(out2014.ability_check_disadvantage);
  });
});

describe("computeConditionEffects — 2014 exhaustion (cumulative)", () => {
  it("level 1: ability_check_disadvantage", () => {
    const out = computeConditionEffects(stateWith([], 1), "2014", ZERO_SCORES);
    expect(out.exhaustion_level).toBe(1);
    expect(out.ability_check_disadvantage).toBe(true);
    expect(out.speed_multiplier).toBe(1);
  });
  it("level 2: + speed_multiplier 0.5", () => {
    const out = computeConditionEffects(stateWith([], 2), "2014", ZERO_SCORES);
    expect(out.ability_check_disadvantage).toBe(true);
    expect(out.speed_multiplier).toBe(0.5);
  });
  it("level 3: + attack_disadvantage + saves_disadvantage_all", () => {
    const out = computeConditionEffects(stateWith([], 3), "2014", ZERO_SCORES);
    expect(out.attack_disadvantage).toBe(true);
    expect(out.saves_disadvantage_all).toBe(true);
  });
  it("level 4: + hp_max_multiplier 0.5", () => {
    const out = computeConditionEffects(stateWith([], 4), "2014", ZERO_SCORES);
    expect(out.hp_max_multiplier).toBe(0.5);
  });
  it("level 5: + speed_floor_zero", () => {
    const out = computeConditionEffects(stateWith([], 5), "2014", ZERO_SCORES);
    expect(out.speed_floor_zero).toBe(true);
  });
  it("level 6: death banner (exhaustion_level === 6)", () => {
    const out = computeConditionEffects(stateWith([], 6), "2014", ZERO_SCORES);
    expect(out.exhaustion_level).toBe(6);
  });
});

describe("computeConditionEffects — 2024 exhaustion (linear formula)", () => {
  it("level 1: -2 d20 penalty, -5 ft speed reduction", () => {
    const out = computeConditionEffects(stateWith([], 1), "2024", ZERO_SCORES);
    expect(out.d20_test_penalty).toBe(-2);
    expect(out.speed_reduction_ft).toBe(5);
  });
  it("level 3: -6 d20 penalty, -15 ft speed reduction", () => {
    const out = computeConditionEffects(stateWith([], 3), "2024", ZERO_SCORES);
    expect(out.d20_test_penalty).toBe(-6);
    expect(out.speed_reduction_ft).toBe(15);
  });
  it("level 6: -12 d20 penalty, -30 ft speed reduction, death banner", () => {
    const out = computeConditionEffects(stateWith([], 6), "2024", ZERO_SCORES);
    expect(out.d20_test_penalty).toBe(-12);
    expect(out.speed_reduction_ft).toBe(30);
    expect(out.exhaustion_level).toBe(6);
  });
  it("level 0: zero penalty", () => {
    const out = computeConditionEffects(stateWith([], 0), "2024", ZERO_SCORES);
    expect(out.d20_test_penalty).toBe(0);
    expect(out.speed_reduction_ft).toBe(0);
  });
  it("2024 exhaustion does NOT set 2014 cumulative flags", () => {
    const out = computeConditionEffects(stateWith([], 3), "2024", ZERO_SCORES);
    expect(out.ability_check_disadvantage).toBe(false);
    expect(out.attack_disadvantage).toBe(false);
    expect(out.saves_disadvantage_all).toBe(false);
    expect(out.speed_multiplier).toBe(1);
  });
});

describe("computeConditionEffects — multi-condition union", () => {
  it("Frightened + Poisoned + Restrained: all flags unioned", () => {
    const out = computeConditionEffects(
      stateWith(["frightened", "poisoned", "restrained"]),
      "2014",
      ZERO_SCORES,
    );
    expect(out.attack_disadvantage).toBe(true);
    expect(out.ability_check_disadvantage).toBe(true);
    expect(out.speed_floor_zero).toBe(true);
    expect(out.save_disadvantage_dex).toBe(true);
    expect(out.attack_advantage_against).toBe(true);
    expect(out.sources).toHaveLength(3);
  });
  it("Invisible + Frightened: both attack_advantage and attack_disadvantage true", () => {
    const out = computeConditionEffects(
      stateWith(["invisible", "frightened"]),
      "2014",
      ZERO_SCORES,
    );
    expect(out.attack_advantage).toBe(true);
    expect(out.attack_disadvantage).toBe(true);
  });
  it("sources[].effects strings are non-empty", () => {
    const out = computeConditionEffects(
      stateWith(["blinded", "poisoned"]),
      "2014",
      ZERO_SCORES,
    );
    for (const s of out.sources) expect(s.effects.length).toBeGreaterThan(0);
  });
});

describe("computeConditionEffects — condition + exhaustion combo", () => {
  it("Paralyzed + 2014 exh3: autofail flags + cumulative exhaustion flags both true", () => {
    const out = computeConditionEffects(stateWith(["paralyzed"], 3), "2014", ZERO_SCORES);
    expect(out.save_autofail_str).toBe(true);
    expect(out.save_autofail_dex).toBe(true);
    expect(out.saves_disadvantage_all).toBe(true);
    expect(out.attack_disadvantage).toBe(true); // exh3
    expect(out.attack_advantage_against).toBe(true); // paralyzed
    expect(out.sources).toHaveLength(2); // paralyzed + exhaustion
  });
  it("Grappled (2014) + 2014 exh5: speed_floor_zero from both", () => {
    const out = computeConditionEffects(stateWith(["grappled"], 5), "2014", ZERO_SCORES);
    expect(out.speed_floor_zero).toBe(true);
  });
});

describe("computeConditionEffects — sources ordering stability", () => {
  it("sources[] is stable across calls with same input", () => {
    const a = computeConditionEffects(
      stateWith(["restrained", "blinded", "frightened"], 2),
      "2014",
      ZERO_SCORES,
    );
    const b = computeConditionEffects(
      stateWith(["frightened", "blinded", "restrained"], 2),
      "2014",
      ZERO_SCORES,
    );
    // Sources sorted by condition slug (alphabetical) then exhaustion last.
    expect(a.sources.map((s) => s.condition)).toEqual(b.sources.map((s) => s.condition));
    expect(a.sources[a.sources.length - 1].condition).toBe("exhaustion");
  });
});
