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

export interface KnownSpellObject {
  spell: string;
  class?: string;
  source?: "class" | "feat" | "item" | "race" | "domain";
  prepared?: boolean;
  always_prepared?: boolean;
}
export type KnownSpellEntry = string | KnownSpellObject;

export type SlotKey = "mainhand" | "offhand" | "armor" | "shield";

export interface EquipmentEntryOverrides {
  name?: string;
  bonus?: number;
  damage_bonus?: number;
  extra_damage?: string;
  ac_bonus?: number;
  action?: "action" | "bonus-action" | "reaction" | "free" | "special";
  range?: string;
}

export interface EquipmentEntryState {
  charges?: { current: number; max: number };
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
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
  spell_slots?: Record<number, number>;
  attunement_limit?: number;
}

export interface CharacterState {
  hp: { current: number; max: number; temp: number };
  hit_dice: Record<string, { used: number; total: number }>;
  spell_slots: Record<number, { used: number; total: number }>;
  spell_slots_pact?: { level: number; used: number; total: number };
  concentration: string | null;
  conditions: ConditionSlug[];
  exhaustion: number;
  death_saves?: { successes: number; failures: number };
  inspiration: number;
  feature_uses: Record<string, { used: number; max: number }>;
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
  spells: { known: KnownSpellEntry[]; overrides: SpellOverride[]; view?: "by-level" | "table" };
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
  informational?: import("../item/item.conditions.types").InformationalBonus[];
  /** Hand slot the attack came from. Used by Actions tab to find the
   *  originating equipment entry for the row-expand panel. */
  slotKey?: "mainhand" | "offhand";
  /** Short caption under the weapon name in the Actions tab table.
   *  e.g. "martial · versatile". Display-only. */
  subLabel?: string;
  /** Action-economy cost for the Cost badge. Defaults to "action" at
   *  render time when absent. Settable via entry.overrides.action. */
  actionCost?: "action" | "bonus-action" | "reaction" | "free" | "special";
  /** When set, the weapon is being wielded one-handed but has a versatile
   *  two-handed option. The Actions tab renders both lines stacked in the
   *  damage cell instead of emitting a second row. */
  versatile?: { damageDice: string };
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
  informational: import("../item/item.conditions.types").InformationalBonus[];
}

export interface DerivedEquipment {
  ac: number;
  acBreakdown: ACTerm[];
  acInformational: import("../item/item.conditions.types").InformationalBonus[];
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
  /** One entry per casting class (multiclass-aware). Empty for non-casters. */
  spellcastingClasses: SpellcastingClassInfo[];
  /** Derived standard slot totals by spell level (before user override). */
  derivedSpellSlots: Record<number, number>;
  /** Warlock Pact Magic, or null. */
  pactMagic: { level: number; total: number } | null;
  /** Per-class known/prepared + cantrip limits (advisory). */
  spellLimits: SpellLimitInfo[];
  warnings: string[];
  defenses: {
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
    condition_immunities: string[];
  };
  acBreakdown: ACTerm[];
  acInformational: import("../item/item.conditions.types").InformationalBonus[];
  attacks: AttackRow[];
  equippedSlots: EquippedSlots;
  carriedWeight: number;
  attunementUsed: number;
  attunementLimit: number;
  conditionEffects: ConditionEffects;
}

export interface SpellcastingClassInfo {
  classSlug: string;
  className: string;
  ability: Ability;
  saveDC: number;
  attackBonus: number;
  casterType: "full" | "half" | "third" | "pact";
  preparation: "known" | "prepared";
}

export interface SpellLimitInfo {
  classSlug: string;
  kind: "known" | "prepared";
  cantripsKnown: number | null;
  preparedOrKnown: number | null;
}

export interface ConditionEffects {
  // Numeric (consumed by recalc to adjust derived stats)
  speed_multiplier: number;          // 1 = normal, 0.5 = halved
  speed_reduction_ft: number;        // 2024 exhaustion: 5 * level
  speed_floor_zero: boolean;         // Grappled, Paralyzed, Petrified, Restrained, Unconscious, exh5 (2014)
  hp_max_multiplier: number;         // 0.5 when exhaustion ≥ 4 (2014)
  d20_test_penalty: number;          // 2024 exhaustion: -2 * level (additive on attacks/saves/checks)
  exhaustion_level: number;          // raw 0..6 mirror

  // Roll-tag flags (consumed by components)
  attack_disadvantage: boolean;
  attack_advantage: boolean;
  attack_advantage_against: boolean; // attackers get advantage vs you (informational; chip tooltip only)
  ability_check_disadvantage: boolean;
  save_disadvantage_dex: boolean;
  save_autofail_str: boolean;
  save_autofail_dex: boolean;
  saves_disadvantage_all: boolean;   // 2014 exh3

  // Action gating
  actions_disabled: boolean;
  reactions_disabled: boolean;

  // Bookkeeping for chip tooltip
  sources: Array<{
    condition: ConditionSlug | "exhaustion";
    level?: number;
    effects: string[];
  }>;
}
