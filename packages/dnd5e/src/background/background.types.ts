import type { Ability, SkillSlug, Choice } from "@archivist/dnd5e";
import type { Edition } from "@archivist/dnd5e/types/edition";
import type { Resource } from "@archivist/dnd5e/types/resource";
import type { StartingEquipmentEntry } from "@archivist/dnd5e/types/equipment-grant";

export type BackgroundToolProficiency =
  | { kind: "fixed"; items: string[] }
  | { kind: "choice"; count: number; from: string[] };

export type BackgroundLanguageProficiency =
  | { kind: "fixed"; languages: string[] }
  | { kind: "choice"; count: number; from: string | string[] };

export interface SuggestedCharacteristics {
  personality_traits?: Record<string, string>;
  ideals?: Record<string, { name?: string; desc: string; alignment?: string }>;
  bonds?: Record<string, string>;
  flaws?: Record<string, string>;
}

export interface BackgroundEntity {
  slug: string;
  name: string;
  edition: Edition;
  source: string;
  description: string;
  skill_proficiencies: SkillSlug[];
  tool_proficiencies: BackgroundToolProficiency[];
  language_proficiencies: BackgroundLanguageProficiency[];
  equipment: StartingEquipmentEntry[];
  feature: { name: string; description: string; resources?: Resource[] };
  ability_score_increases: { pool: Ability[] } | null;
  origin_feat: string | null;
  suggested_characteristics: SuggestedCharacteristics | null;
  choices?: Choice[];
}
