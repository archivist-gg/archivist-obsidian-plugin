import type { Feature, Choice, Ability, SkillSlug, Resource } from "../../shared/types";
import type { StartingEquipmentEntry, StartingGold } from "../../shared/types/equipment-grant";
export type { StartingEquipmentEntry, StartingGold } from "../../shared/types/equipment-grant";
import type { SelectionPool, PoolGrant, TabDecl } from "../../shared/types/selection-pool";

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

export type CasterType = "full" | "half" | "third" | "pact";
export type SpellcastingPreparation = "known" | "prepared";

export interface SpellcastingConfig {
  caster_type: CasterType;
  ability: Ability;
  preparation: SpellcastingPreparation;
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
  starting_gold?: StartingGold;
  spellcasting: SpellcastingConfig | null;
  subclass_level: number;
  subclass_feature_name: string;
  weapon_mastery: WeaponMasteryConfig | null;
  epic_boon_level: number | null;
  table: Record<number, ClassTableRow>;
  features_by_level: Record<number, Feature[]>;
  resources: Resource[];
  selection_pools?: SelectionPool[];
  pool_grants?: PoolGrant[];
  tabs?: TabDecl[];
}
