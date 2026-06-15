import type { FeatureEffect, SenseType } from "../../shared/types/feature-effect";
import type { Ability } from "../../shared/types";
import { ABILITY_KEYS } from "../../shared/dnd/constants";
import type { ResolvedFeature } from "./pc.types";

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
    default:
      // apply-condition, damage-bonus, and future kinds: not derived-stat effects.
      break;
  }
}
