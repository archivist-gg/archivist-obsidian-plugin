import type { Feature, Ability, Speed } from "../../shared/types";
import type { Edition } from "../class/class.types";

export type Size = "tiny" | "small" | "medium" | "large" | "huge";

export type FixedAbilityIncrease = { ability: Ability; amount: number };
export type ChoiceAbilityIncrease = { choose: number; pool: Ability[]; amount: number };
export type AbilityScoreIncrease = FixedAbilityIncrease | ChoiceAbilityIncrease;

export interface Vision {
  darkvision?: number;
  blindsight?: number;
  tremorsense?: number;
  truesight?: number;
}

export interface LanguageProficiencies {
  fixed: string[];
  choice?: { count: number; from: string | string[] };
}

export interface RaceVariant {
  slug: string;
  name: string;
  description: string;
  ability_score_increases?: AbilityScoreIncrease[];
  speed_delta?: Partial<Speed>;
  traits?: Feature[];
  vision?: Vision;
}

export interface RaceEntity {
  slug: string;
  name: string;
  edition: Edition;
  source: string;
  description: string;
  size: Size;
  speed: Speed;
  ability_score_increases: AbilityScoreIncrease[];
  age: string;
  alignment: string;
  vision: Vision;
  languages: LanguageProficiencies;
  variant_label: string;
  variants: RaceVariant[];
  traits: Feature[];
}
