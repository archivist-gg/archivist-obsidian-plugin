import type { Ability, SkillSlug, Feature } from "../../shared/types";
import type { ClassEntity } from "../class/class.types";
import type { RaceEntity } from "../race/race.types";
import type { SubclassEntity } from "../subclass/subclass.types";
import type { BackgroundEntity } from "../background/background.types";
import type { FeatEntity } from "../feat/feat.types";

// ─────────────────────────────────────────────────────────────
// Definition (parsed from YAML; slugs unresolved)
// ─────────────────────────────────────────────────────────────

export type Edition = "2014" | "2024";

export type AbilityMethod = "standard-array" | "point-buy" | "rolled" | "manual";

export interface ClassEntry {
  name: string;                        // "[[rogue]]" or "rogue"
  level: number;
  subclass: string | null;             // "[[soulknife]]" or null
  choices: Record<number, unknown>;    // per-level; typed loosely in SP3
}

export interface SpellOverride {
  slug: string;
  overrides: Record<string, unknown>;
}

export type EquipmentEntry =
  | { item: string; equipped?: boolean; attuned?: boolean; qty?: number; notes?: string };

export interface CharacterOverrides {
  scores?: Partial<Record<Ability, number>>;
  saves?: Partial<Record<Ability, { bonus: number; proficient?: boolean }>>;
  skills?: Partial<Record<SkillSlug, { bonus: number; proficiency?: "none" | "proficient" | "expertise" }>>;
  passives?: Partial<{ perception: number; investigation: number; insight: number }>;
  hp?: { max?: number };
  ac?: number;
  speed?: number;
  initiative?: number;
  spellcasting?: { saveDC?: number; attackBonus?: number };
}

export interface CharacterState {
  hp: { current: number; max: number; temp: number };
  hit_dice: Record<string, { used: number; total: number }>;
  spell_slots: Record<number, { used: number; total: number }>;
  concentration: string | null;
  conditions: string[];
  death_saves?: { successes: number; failures: number };
  inspiration?: boolean;
  currency?: { cp: number; sp: number; ep: number; gp: number; pp: number };
  attuned_items?: string[];
}

export interface Character {
  name: string;
  edition: Edition;
  alignment?: string;
  race: string | null;
  subrace: string | null;
  background: string | null;
  class: ClassEntry[];
  abilities: Record<Ability, number>;
  ability_method: AbilityMethod;
  skills: { proficient: SkillSlug[]; expertise: SkillSlug[] };
  spells: { known: string[]; overrides: SpellOverride[] };
  equipment: EquipmentEntry[];
  overrides: CharacterOverrides;
  notes?: string;
  state: CharacterState;
}

// ─────────────────────────────────────────────────────────────
// Resolved (after slug lookups against EntityRegistry)
// ─────────────────────────────────────────────────────────────

export type FeatureSource =
  | { kind: "class"; slug: string; level: number }
  | { kind: "subclass"; slug: string; level: number }
  | { kind: "race"; slug: string }
  | { kind: "background"; slug: string }
  | { kind: "feat"; slug: string };

export interface ResolvedFeature {
  feature: Feature;
  source: FeatureSource;
}

export interface ResolvedClass {
  entity: ClassEntity | null;
  level: number;
  subclass: SubclassEntity | null;
  choices: Record<number, unknown>;
}

export interface ResolvedCharacter {
  definition: Character;
  race: RaceEntity | null;
  classes: ResolvedClass[];
  background: BackgroundEntity | null;
  feats: FeatEntity[];
  totalLevel: number;
  features: ResolvedFeature[];
  state: CharacterState;
}

// ─────────────────────────────────────────────────────────────
// Derived (output of recalc; consumed by components)
// ─────────────────────────────────────────────────────────────

export interface DerivedStats {
  totalLevel: number;
  proficiencyBonus: number;
  scores: Record<Ability, number>;
  mods: Record<Ability, number>;
  saves: Record<Ability, { bonus: number; proficient: boolean }>;
  skills: Record<SkillSlug, {
    bonus: number;
    proficiency: "none" | "proficient" | "expertise";
    ability: Ability;
  }>;
  passives: { perception: number; investigation: number; insight: number };
  hp: { max: number; current: number; temp: number };
  ac: number;
  speed: number;
  initiative: number;
  spellcasting: {
    ability: Ability;
    saveDC: number;
    attackBonus: number;
    preparedCount?: number;
  } | null;
  warnings: string[];
}
