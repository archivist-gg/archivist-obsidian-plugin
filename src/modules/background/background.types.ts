import type { Ability, SkillSlug } from "../../shared/types";
import type { Edition } from "../class/class.types";

export type BackgroundToolProficiency =
  | { kind: "fixed"; items: string[] }
  | { kind: "choice"; count: number; from: string[] };

export type BackgroundLanguageProficiency =
  | { kind: "fixed"; languages: string[] }
  | { kind: "choice"; count: number; from: string | string[] };

export type BackgroundEquipmentEntry =
  | { item: string; quantity: number }
  | { kind: "currency"; gp?: number; sp?: number; cp?: number; pp?: number; ep?: number };

export interface SuggestedCharacteristics {
  personality_traits?: Record<string, string>;
  ideals?: Record<string, { name?: string; desc: string; alignment?: string }>;
  bonds?: Record<string, string>;
  flaws?: Record<string, string>;
}

export interface BackgroundVariant {
  slug: string;
  name: string;
  description: string;
  feature?: { name: string; description: string };
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
  equipment: BackgroundEquipmentEntry[];
  feature: { name: string; description: string };
  ability_score_increases: { pool: Ability[] } | null;
  origin_feat: string | null;
  suggested_characteristics: SuggestedCharacteristics | null;
  variants: BackgroundVariant[];
}
