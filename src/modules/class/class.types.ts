import type { Feature, Choice, Ability, SkillSlug, Resource } from "../../shared/types";

export type Edition = "2014" | "2024";
export type ArmorCategory = "light" | "medium" | "heavy" | "shield";
export type WeaponCategory = "simple" | "martial";

export interface WeaponProficiency {
  fixed?: string[];
  categories?: WeaponCategory[];
  conditional?: Array<{ category: WeaponCategory; where_property: string[] }>;
}

export interface ToolProficiency {
  fixed?: string[];
  choice?: { count: number; from: string[] };
}

export interface ClassProficiencies {
  armor: ArmorCategory[];
  weapons: WeaponProficiency;
  tools?: ToolProficiency;
}

export interface SkillChoices {
  count: number;
  from: SkillSlug[];
}

export type StartingEquipmentEntry =
  | { kind: "choice"; options: string[] }
  | { kind: "fixed"; items: string[] }
  | { kind: "gold"; amount: number };

export type SpellcastingPreparation = "known" | "prepared" | "ritual" | "spontaneous";

export interface SpellcastingConfig {
  ability: Ability;
  preparation: SpellcastingPreparation;
  cantrip_progression?: Record<number, number>;
  spells_known_formula?: string;
  spell_list: string;
}

export interface WeaponMasteryConfig {
  starting_count: number;
  scaling?: Record<number, number>;
}

export interface ClassTableRow {
  prof_bonus: number;
  columns?: Record<string, string | number>;
  feature_ids: string[];
}

export interface ClassEntity {
  slug: string;
  name: string;
  edition: Edition;
  source: string;
  description: string;
  hit_die: string;
  primary_abilities: Ability[];
  saving_throws: Ability[];
  proficiencies: ClassProficiencies;
  skill_choices: SkillChoices;
  starting_equipment: StartingEquipmentEntry[];
  spellcasting: SpellcastingConfig | null;
  subclass_level: number;
  subclass_feature_name: string;
  weapon_mastery: WeaponMasteryConfig | null;
  epic_boon_level: number | null;
  table: Record<number, ClassTableRow>;
  features_by_level: Record<number, Feature[]>;
  resources: Resource[];
}
