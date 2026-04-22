import type { Abilities } from "./abilities";

export type Ability = keyof Abilities;

export type SkillSlug =
  | "acrobatics"
  | "animal-handling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleight-of-hand"
  | "stealth"
  | "survival";

export type FeatCategory = "origin" | "general" | "fighting-style" | "epic-boon";

export type Choice =
  | { kind: "skill"; count: number; from?: SkillSlug[] }
  | { kind: "skill-expertise"; count: number; from_proficient: boolean }
  | { kind: "subclass" }
  | { kind: "feat"; category?: FeatCategory }
  | { kind: "asi" }
  | { kind: "ability-score"; count: number; pool?: Ability[]; each: number }
  | { kind: "fighting-style"; from: string[] }
  | { kind: "language"; count: number; exclude?: string[] }
  | { kind: "tool"; count: number; from?: string[] }
  | { kind: "spell"; count: number; level?: number; from_list: string };
