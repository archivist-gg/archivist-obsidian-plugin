import type { Ability, SkillSlug, Feature } from "../../shared/types";
import type { ClassEntity } from "../class/class.types";
import type { RaceEntity } from "../race/race.types";
import type { SubclassEntity } from "../subclass/subclass.types";
import type { BackgroundEntity } from "../background/background.types";
import type { FeatEntity } from "../feat/feat.types";
import type { ArmorEntity } from "../armor/armor.types";
import type { WeaponEntity } from "../weapon/weapon.types";
import type { ItemEntity } from "../item/item.types";

export type { ConditionSlug } from "./constants/conditions";
import type { ConditionSlug } from "./constants/conditions";

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

export type SlotKey = "mainhand" | "offhand" | "armor" | "shield";

export interface EquipmentEntryOverrides {
  name?: string;
  bonus?: number;
  damage_bonus?: number;
  extra_damage?: string;
  ac_bonus?: number;
}

export interface EquipmentEntryState {
  charges?: { current: number; max: number };
  recovery?: { amount: string; reset: "dawn" | "short" | "long" };
  depletion_risk?: { trigger: string; roll: string; threshold: number; effect: string };
}

export type EquipmentEntry =
  | {
      item: string;
      equipped?: boolean;
      attuned?: boolean;
      qty?: number;
      notes?: string;
      slot?: SlotKey | null;
      overrides?: EquipmentEntryOverrides;
      state?: EquipmentEntryState;
    };

export type PassiveKind = "perception" | "investigation" | "insight";

export interface CharacterOverrides {
  scores?: Partial<Record<Ability, number>>;
  saves?: Partial<Record<Ability, { bonus?: number; proficient?: boolean }>>;
  skills?: Partial<Record<SkillSlug, { bonus: number; proficiency?: "none" | "proficient" | "expertise" }>>;
  passives?: Partial<{ perception: number; investigation: number; insight: number }>;
  hp?: { max?: number };
  ac?: number;
  speed?: number;
  initiative?: number;
  spellcasting?: { saveDC?: number; attackBonus?: number };
  attunement_limit?: number;
}

export interface CharacterState {
  hp: { current: number; max: number; temp: number };
  hit_dice: Record<string, { used: number; total: number }>;
  spell_slots: Record<number, { used: number; total: number }>;
  concentration: string | null;
  conditions: ConditionSlug[];
  exhaustion: number;
  death_saves?: { successes: number; failures: number };
  inspiration: number;
  /** @deprecated SP5: moved to Character.currency. Tolerated until Task 4 parser migration strips it. */
  currency?: { cp: number; sp: number; ep: number; gp: number; pp: number };
  /** @deprecated SP5: removed; per-entry attuned flag is canonical. Tolerated until Task 4 parser migration strips it. */
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
  currency?: { cp: number; sp: number; ep: number; gp: number; pp: number };
  notes?: string;
  defenses?: {
    resistances?: string[];
    immunities?: string[];
    vulnerabilities?: string[];
    condition_immunities?: string[];
  };
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

export interface ProficiencySet {
  categories: string[];
  specific: string[];
}

// ─────────────────────────────────────────────────────────────
// Derived (output of recalc; consumed by components)
// ─────────────────────────────────────────────────────────────

export interface ACTerm {
  source: string;
  amount: number;
  kind: "armor" | "shield" | "item" | "unarmored" | "override" | "dex" | "ability";
}

export interface AttackRow {
  id: string;
  name: string;
  range?: string;
  toHit: number;
  damageDice: string;
  damageType: string;
  extraDamage?: string;
  properties: string[];
  proficient: boolean;
  breakdown: { toHit: ACTerm[]; damage: ACTerm[] };
}

export interface ResolvedEquipped {
  index: number;
  entity: ArmorEntity | WeaponEntity | ItemEntity | null;
  entityType: string | null;
  entry: EquipmentEntry;
}

export interface EquippedSlots {
  mainhand?: ResolvedEquipped;
  offhand?: ResolvedEquipped;
  armor?: ResolvedEquipped;
  shield?: ResolvedEquipped;
}

export interface AppliedBonuses {
  ability_bonuses: Partial<Record<Ability, number>>;
  ability_statics: Partial<Record<Ability, number>>;
  save_bonus: number;
  speed_bonuses: { walk: number; fly: number | "walk" | null; swim: number; climb: number };
  spell_attack: number;
  spell_save_dc: number;
  defenses: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; condition_immunities: string[] };
}

export interface DerivedEquipment {
  ac: number;
  acBreakdown: ACTerm[];
  attacks: AttackRow[];
  equippedSlots: EquippedSlots;
  carriedWeight: number;
  attunementUsed: number;
  attunementLimit: number;
}

export interface DerivedStats {
  totalLevel: number;
  proficiencyBonus: number;
  scores: Record<Ability, number>;
  mods: Record<Ability, number>;
  saves: Record<Ability, { bonus: number; proficient: boolean }>;
  proficiencies: {
    armor: ProficiencySet;
    weapons: ProficiencySet;
    tools: ProficiencySet;
    languages: string[];
    saves: Ability[];
  };
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
  defenses: {
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
    condition_immunities: string[];
  };
  acBreakdown: ACTerm[];
  attacks: AttackRow[];
  equippedSlots: EquippedSlots;
  carriedWeight: number;
  attunementUsed: number;
  attunementLimit: number;
}
