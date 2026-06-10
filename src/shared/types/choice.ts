import type { Abilities } from "./abilities";
import type { FeatureEffect } from "./feature-effect";

export type Ability = keyof Abilities;

export type SkillSlug =
  | "acrobatics" | "animal-handling" | "arcana" | "athletics" | "deception"
  | "history" | "insight" | "intimidation" | "investigation" | "medicine"
  | "nature" | "perception" | "performance" | "persuasion" | "religion"
  | "sleight-of-hand" | "stealth" | "survival";

export const ALL_SKILL_SLUGS: SkillSlug[] = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
];

export type FeatCategory = "origin" | "general" | "fighting-style" | "epic-boon";

/** Closed, enumerated registry filter — YAML can never express a query the
 *  engine would apply unsafely. `"self"` resolves against the owning
 *  class/subclass at ledger-build time. */
export interface EntityFilter {
  feature_type?: string;     // optional-feature kind: invocation | metamagic | fighting_style | ...
  category?: string;         // feat category
  parent_class?: "self";
  available_to?: "self";
}

export interface InlineOption {
  value: string;
  label: string;
  description?: string;
  /** Applied via a synthesized resolved feature when the option is selected. */
  effects?: FeatureEffect[];
  /** Nested decisions revealed when this option is selected (recursive). */
  choices?: Choice[];
}

/** The four game-agnostic decision primitives. All game knowledge (which
 *  options, which counts) lives in data — authored in the SRD overlay or
 *  inline in homebrew entity notes. `id` is the persistence key under
 *  `ClassEntry.choices[level]` / `Character.origin_choices`. */
export type Choice =
  | { kind: "select-inline"; id: string; label?: string; count?: number; options: InlineOption[] }
  | {
      kind: "select-entity"; id: string; label?: string; count?: number;
      entity_type: string; from?: string[]; where?: EntityFilter;
    }
  | {
      kind: "select-proficiency"; id: string; label?: string; count: number;
      domain: "skill" | "tool" | "language" | "save";
      from?: string[]; from_proficient?: boolean; expertise?: boolean;
    }
  | { kind: "ability-points"; id: string; label?: string; points: number; max_per: number; pool?: Ability[] };
