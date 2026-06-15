import type { FeatureEffect, SenseType } from "../../shared/types/feature-effect";
import type { Ability } from "../../shared/types";
import { ABILITY_KEYS } from "../../shared/dnd/constants";
import type { ResolvedFeature, RollModifierEntry } from "./pc.types";

/**
 * Aggregated passive feature effects (effects-application engine).
 * One pure scan over resolved.features[].feature.effects[]. Merge semantics
 * mirror pc.conditions mergePartial: numbers add, each sense range takes max,
 * lists union case-insensitively. apply-condition and damage-bonus are action/attack
 * time and intentionally not aggregated; `while`-gated immune-condition
 * entries are skipped entirely (conditional effects are a named deferral).
 */
export interface FeatureEffectTotals {
  initiative_bonus: number;
  hp_per_level_bonus: number;
  speed_walk_bonus: number;
  /** Max range per sense type granted by effects; 0 = none for that type. */
  senses: Record<SenseType, number>;
  /** One term per ac-bonus effect, labeled with the owning feature's name. */
  ac_terms: { value: number; requires_armor: boolean; label: string }[];
  resistances: string[];
  condition_immunities: string[];
  /** skills are kebab-case slugs; saves are canonical ability keys. */
  proficiencies: { skills: string[]; tools: string[]; languages: string[]; saves: Ability[] };
  /**
   * v1 global melee-attack ability override (Hexblade "Lies", etc.). The first
   * `weapon-ability` effect with a concrete ability (not `"spellcasting"`) wins;
   * `"spellcasting"` is resolved against the caster ability in recalc. `weapons`
   * scope is parsed but ignored here (global override). null = no override.
   */
  weaponAbility: Ability | null;
  /**
   * Order-preserving list of structured advantage/disadvantage entries from
   * `roll-modifier` effects. Pass-through (no dedupe/merge); each entry is
   * labeled with the owning feature's name.
   */
  rollModifiers: RollModifierEntry[];
  /**
   * Lowest weapon-attack crit threshold (natural roll that scores a critical
   * hit) granted by `crit-range` effects. Folds via Math.min from init 20, so
   * 20 = no expansion. spell-only (`applies_to:"spell"`) entries do NOT lower
   * it. recalc maps this onto each AttackRow as `critRange` only when < 20.
   */
  critRange: number;
  /**
   * Max extra attacks per Attack action granted by `extra-attack` effects.
   * Non-stacking (D&D Extra Attack features don't stack): folds via Math.max
   * from init 0, so 0 = no extra attacks. recalc maps this onto
   * DerivedStats.attacksPerAction as `1 + extraAttack`.
   */
  extraAttack: number;
  /**
   * Order-preserving display-only captions surfaced from `reroll-damage` and
   * `attack-rule` effects (e.g. "Reroll 2s", "No disadvantage firing in melee").
   * recalc post-applies this list onto each AttackRow as `attackNotes` only when
   * non-empty, so untouched attack rows keep `attackNotes: undefined`.
   */
  attackNotes: string[];
}

export function emptyFeatureEffectTotals(): FeatureEffectTotals {
  return {
    initiative_bonus: 0,
    hp_per_level_bonus: 0,
    speed_walk_bonus: 0,
    senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
    ac_terms: [],
    resistances: [],
    condition_immunities: [],
    proficiencies: { skills: [], tools: [], languages: [], saves: [] },
    weaponAbility: null,
    rollModifiers: [],
    critRange: 20,
    extraAttack: 0,
    attackNotes: [],
  };
}

const ABILITY_NAME_TO_KEY: Record<string, Ability> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function normalizeAbility(value: string): Ability | null {
  const k = value.trim().toLowerCase();
  if ((ABILITY_KEYS as readonly string[]).includes(k)) return k as Ability;
  return ABILITY_NAME_TO_KEY[k] ?? null;
}

function pushUnique(list: string[], value: string): void {
  const key = value.trim().toLowerCase();
  if (!key) return;
  if (!list.some((v) => v.trim().toLowerCase() === key)) list.push(value.trim());
}

export function computeFeatureEffects(features: ResolvedFeature[]): FeatureEffectTotals {
  const out = emptyFeatureEffectTotals();
  for (const rf of features) {
    for (const eff of rf.feature.effects ?? []) {
      applyEffect(out, eff, rf.feature.name ?? "Feature");
    }
  }
  return out;
}

function applyEffect(out: FeatureEffectTotals, eff: FeatureEffect, label: string): void {
  switch (eff.kind) {
    case "initiative-bonus":
      out.initiative_bonus += eff.value;
      break;
    case "hp-per-level-bonus":
      out.hp_per_level_bonus += eff.value;
      break;
    case "speed-bonus":
      // Only walk reaches DerivedStats.speed; other modes have no derived surface yet.
      if (eff.mode === "walk") out.speed_walk_bonus += eff.value;
      break;
    case "sense":
      out.senses[eff.type] = Math.max(out.senses[eff.type], eff.range);
      break;
    case "resistance":
      pushUnique(out.resistances, eff.damage_type);
      break;
    case "immune-condition":
      if (!eff.while) pushUnique(out.condition_immunities, eff.condition);
      break;
    case "proficiency": {
      if (eff.proficiency_type === "skill") {
        pushUnique(out.proficiencies.skills, eff.value.toLowerCase().replace(/\s+/g, "-"));
      } else if (eff.proficiency_type === "tool") {
        pushUnique(out.proficiencies.tools, eff.value);
      } else if (eff.proficiency_type === "language") {
        pushUnique(out.proficiencies.languages, eff.value);
      } else {
        const ab = normalizeAbility(eff.value);
        if (ab && !out.proficiencies.saves.includes(ab)) out.proficiencies.saves.push(ab);
      }
      break;
    }
    case "ac-bonus":
      out.ac_terms.push({ value: eff.value, requires_armor: eff.requires_armor === true, label });
      break;
    case "weapon-ability":
      // v1: first concrete-ability override with an unscoped/global intent wins.
      // The "spellcasting" sentinel is resolved in recalc (the fold lacks caster
      // context); `weapons` scope is carried in the schema but ignored here.
      if (out.weaponAbility === null && eff.ability !== "spellcasting") out.weaponAbility = eff.ability;
      break;
    case "roll-modifier":
      // Order-preserving pass-through: one entry per effect, labeled with the
      // owning feature's name for the chip tooltip. No dedupe/merge.
      out.rollModifiers.push({ mode: eff.mode, roll: eff.roll, scope: eff.scope, condition: eff.condition, label });
      break;
    case "crit-range":
      // Lowest threshold across weapon/all crit-range effects wins. A spell-only
      // crit-range does NOT lower the weapon crit threshold (no spell surface here).
      if ((eff.applies_to ?? "weapon") !== "spell") out.critRange = Math.min(out.critRange, eff.min_roll);
      break;
    case "extra-attack":
      // Non-stacking: Extra Attack features don't add together (two count:1
      // effects → 1 extra attack, not 2). Highest count wins.
      out.extraAttack = Math.max(out.extraAttack, eff.count);
      break;
    case "reroll-damage":
      // Display-only caption. v1 does not filter by applies_to (unlike crit-range);
      // a spell-only reroll still surfaces a note here.
      out.attackNotes.push(`Reroll ${eff.max_reroll}s${eff.once_per_die ? " (once/die)" : ""}`);
      break;
    case "attack-rule":
      if (eff.flag === "no-ranged-in-melee-disadvantage") out.attackNotes.push("No disadvantage firing in melee");
      break;
    default:
      // apply-condition, damage-bonus, and future kinds: not derived-stat effects.
      break;
  }
}
