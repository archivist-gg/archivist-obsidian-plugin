import type { Choice, Ability, FeatCategory, FeatureEffect } from "@archivist/dnd5e";
import type { Edition } from "@archivist/dnd5e/types/edition";
import type { Resource } from "@archivist/dnd5e/types/resource";

export type FeatPrerequisite =
  | { kind: "ability"; ability: Ability; min: number }
  | { kind: "level"; min: number }
  | { kind: "spellcaster" }
  | { kind: "proficiency"; proficiency_type: "armor" | "weapon" | "tool" | "skill" | "saving-throw"; value: string }
  | { kind: "race"; slug: string }
  | { kind: "class"; slug: string };

export interface FeatGrantsAsi {
  amount: number;
  pool?: Ability[];
}

export interface FeatEntity {
  slug: string;
  name: string;
  edition: Edition;
  source: string;
  category: FeatCategory;
  description: string;
  prerequisites: FeatPrerequisite[];
  benefits: string[];
  effects: FeatureEffect[];
  grants_asi: FeatGrantsAsi | null;
  repeatable: boolean;
  choices: Choice[];
  resources?: Resource[];
}
