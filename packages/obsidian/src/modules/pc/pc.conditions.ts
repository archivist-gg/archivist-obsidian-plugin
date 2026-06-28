import type { CharacterState, Edition, ConditionEffects } from "./pc.types";
import type { ConditionSlug } from "./constants/conditions";
import type { Ability } from "@archivist/dnd5e";

type PartialConditionEffect = Omit<Partial<ConditionEffects>, "sources">;

const ZERO_EFFECTS: ConditionEffects = {
  speed_multiplier: 1,
  speed_reduction_ft: 0,
  speed_floor_zero: false,
  hp_max_multiplier: 1,
  d20_test_penalty: 0,
  exhaustion_level: 0,
  attack_disadvantage: false,
  attack_advantage: false,
  attack_advantage_against: false,
  ability_check_disadvantage: false,
  save_disadvantage_dex: false,
  save_autofail_str: false,
  save_autofail_dex: false,
  saves_disadvantage_all: false,
  actions_disabled: false,
  reactions_disabled: false,
  sources: [],
};

const CONDITION_EFFECTS_2014: Record<ConditionSlug, PartialConditionEffect> = {
  blinded: { attack_disadvantage: true, attack_advantage_against: true },
  charmed: {},
  deafened: {},
  frightened: { attack_disadvantage: true, ability_check_disadvantage: true },
  grappled: { speed_floor_zero: true },
  incapacitated: { actions_disabled: true, reactions_disabled: true },
  invisible: { attack_advantage: true },
  paralyzed: {
    speed_floor_zero: true,
    save_autofail_str: true,
    save_autofail_dex: true,
    attack_advantage_against: true,
    actions_disabled: true,
    reactions_disabled: true,
  },
  petrified: {
    speed_floor_zero: true,
    save_autofail_str: true,
    save_autofail_dex: true,
    attack_advantage_against: true,
    actions_disabled: true,
    reactions_disabled: true,
  },
  poisoned: { attack_disadvantage: true, ability_check_disadvantage: true },
  prone: { attack_disadvantage: true },
  restrained: {
    speed_floor_zero: true,
    attack_disadvantage: true,
    attack_advantage_against: true,
    save_disadvantage_dex: true,
  },
  stunned: {
    save_autofail_str: true,
    save_autofail_dex: true,
    attack_advantage_against: true,
    actions_disabled: true,
    reactions_disabled: true,
  },
  unconscious: {
    speed_floor_zero: true,
    save_autofail_str: true,
    save_autofail_dex: true,
    attack_advantage_against: true,
    actions_disabled: true,
    reactions_disabled: true,
  },
};

// 2024 differs only on Grappled (adds disadvantage on attacks vs non-grappler).
const CONDITION_EFFECTS_2024: Record<ConditionSlug, PartialConditionEffect> = {
  ...CONDITION_EFFECTS_2014,
  grappled: { speed_floor_zero: true, attack_disadvantage: true },
};

const EXHAUSTION_EFFECTS_2014: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, PartialConditionEffect> = {
  0: {},
  1: { ability_check_disadvantage: true },
  2: { ability_check_disadvantage: true, speed_multiplier: 0.5 },
  3: {
    ability_check_disadvantage: true,
    speed_multiplier: 0.5,
    attack_disadvantage: true,
    saves_disadvantage_all: true,
  },
  4: {
    ability_check_disadvantage: true,
    speed_multiplier: 0.5,
    attack_disadvantage: true,
    saves_disadvantage_all: true,
    hp_max_multiplier: 0.5,
  },
  5: {
    ability_check_disadvantage: true,
    speed_multiplier: 0.5,
    attack_disadvantage: true,
    saves_disadvantage_all: true,
    hp_max_multiplier: 0.5,
    speed_floor_zero: true,
  },
  6: {
    ability_check_disadvantage: true,
    speed_multiplier: 0.5,
    attack_disadvantage: true,
    saves_disadvantage_all: true,
    hp_max_multiplier: 0.5,
    speed_floor_zero: true,
  },
};

function exhaustionEffects2024(level: number): PartialConditionEffect {
  if (level <= 0) return {};
  return {
    d20_test_penalty: -2 * level,
    speed_reduction_ft: 5 * level,
  };
}

const CONDITION_TOOLTIPS_2014: Record<ConditionSlug, string[]> = {
  blinded: ["Auto-fail any check requiring sight."],
  charmed: [
    "Can't attack the charmer or target them with harmful effects.",
    "Charmer has advantage on social checks against you.",
  ],
  deafened: ["Auto-fail any check requiring hearing."],
  frightened: [
    "Disadvantage on attacks/checks while source in line of sight.",
    "Can't willingly move closer to source.",
  ],
  grappled: ["Speed = 0. Ends if grappler is incapacitated or you're moved out of reach."],
  incapacitated: ["Can't take actions or reactions."],
  invisible: [
    "Heavily obscured for hiding.",
    "Your attacks have advantage; attacks against you have disadvantage.",
    "Detectable by noise/tracks.",
  ],
  paralyzed: [
    "Incapacitated. Speed 0.",
    "Auto-fail STR/DEX saves.",
    "Attacks against have advantage; melee within 5ft auto-crit.",
  ],
  petrified: [
    "Incapacitated. Speed 0.",
    "Resist all damage. Immune to poison/disease.",
    "Auto-fail STR/DEX saves.",
  ],
  poisoned: ["Disadvantage on attack rolls and ability checks."],
  prone: [
    "Attacks against within 5ft have advantage; beyond 5ft have disadvantage.",
    "Your attacks have disadvantage.",
  ],
  restrained: [
    "Speed 0. Disadvantage on attacks and DEX saves.",
    "Attacks against have advantage.",
  ],
  stunned: [
    "Incapacitated. Auto-fail STR/DEX saves.",
    "Attacks against have advantage.",
  ],
  unconscious: [
    "Incapacitated, prone, dropped held items. Speed 0.",
    "Auto-fail STR/DEX saves.",
    "Attacks against have advantage; melee within 5ft auto-crit.",
  ],
};

const CONDITION_TOOLTIPS_2024: Record<ConditionSlug, string[]> = {
  ...CONDITION_TOOLTIPS_2014,
  grappled: [
    "Speed = 0. Disadvantage on attack rolls against creatures other than the grappler.",
    "Ends if grappler is incapacitated or you're moved out of reach.",
  ],
};

export function computeConditionEffects(
  state: CharacterState,
  edition: Edition,
  _scores: Record<Ability, number>,
): ConditionEffects {
  const out: ConditionEffects = { ...ZERO_EFFECTS, sources: [] };
  const conditionTable = edition === "2024" ? CONDITION_EFFECTS_2024 : CONDITION_EFFECTS_2014;
  const tooltipTable = edition === "2024" ? CONDITION_TOOLTIPS_2024 : CONDITION_TOOLTIPS_2014;

  // Sort conditions alphabetically for stable sources[] ordering.
  const sortedConditions = [...new Set(state.conditions)].sort();
  for (const slug of sortedConditions) {
    const partial = conditionTable[slug];
    if (!partial) continue;
    mergePartial(out, partial);
    out.sources.push({
      condition: slug,
      effects: tooltipTable[slug] ?? [],
    });
  }

  const exhLevel = clamp(state.exhaustion ?? 0, 0, 6);
  out.exhaustion_level = exhLevel;
  if (exhLevel > 0) {
    const exhPartial = edition === "2024"
      ? exhaustionEffects2024(exhLevel)
      : EXHAUSTION_EFFECTS_2014[exhLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6];
    mergePartial(out, exhPartial);
    out.sources.push({
      condition: "exhaustion",
      level: exhLevel,
      effects: exhaustionTooltip(exhLevel, edition),
    });
  }

  return out;
}

function mergePartial(out: ConditionEffects, partial: PartialConditionEffect): void {
  for (const k of Object.keys(partial) as Array<keyof PartialConditionEffect>) {
    const v = partial[k];
    if (typeof v === "boolean") {
      // Boolean flags OR together.
      (out as Record<string, unknown>)[k] = (out as Record<string, boolean>)[k] || v;
    } else if (typeof v === "number") {
      // Numeric: speed_multiplier and hp_max_multiplier MIN (smaller wins);
      // d20_test_penalty and speed_reduction_ft ADD (more penalty wins).
      if (k === "speed_multiplier" || k === "hp_max_multiplier") {
        (out as Record<string, number>)[k] = Math.min((out as Record<string, number>)[k], v);
      } else {
        (out as Record<string, number>)[k] = (out as Record<string, number>)[k] + v;
      }
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function exhaustionTooltip(level: number, edition: Edition): string[] {
  if (edition === "2024") {
    return [
      `−${2 * level} on all d20 tests (attacks, saves, ability checks).`,
      `Speed reduced by ${5 * level} ft.`,
      level >= 6 ? "Death." : `Long rest reduces by 1 level.`,
    ];
  }
  // 2014 cumulative
  const lines: string[] = [];
  if (level >= 1) lines.push("Disadvantage on ability checks.");
  if (level >= 2) lines.push("Speed halved.");
  if (level >= 3) lines.push("Disadvantage on attack rolls and saving throws.");
  if (level >= 4) lines.push("Hit point maximum halved.");
  if (level >= 5) lines.push("Speed reduced to 0.");
  if (level >= 6) lines.push("Death.");
  return lines;
}
