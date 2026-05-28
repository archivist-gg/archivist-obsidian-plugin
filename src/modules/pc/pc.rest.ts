// src/modules/pc/pc.rest.ts
import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { Character, DerivedStats, ResolvedCharacter } from "./pc.types";

export type RestType = "short" | "long";

export type RestCategoryId =
  | "hp-to-max"
  | "hd-regain"
  | "spell-slots"
  | "exhaustion"
  | `feature:${string}`
  | `item:${number}`;

export interface RestCategory {
  id: RestCategoryId;
  label: string;
  preview: string;
}

export interface RestPlan {
  type: RestType;
  categories: RestCategory[];
  hdAvailable: Array<{ die: string; remaining: number }>;
}

export function computeRestPlan(
  _character: Character,
  _resolved: ResolvedCharacter,
  _derived: DerivedStats,
  _registry: EntityRegistry | null,
  type: RestType,
): RestPlan {
  return { type, categories: [], hdAvailable: [] };
}

export function applyRestResets(
  _character: Character,
  _resolved: ResolvedCharacter,
  _derived: DerivedStats,
  _plan: RestPlan,
  _optouts: Set<RestCategoryId>,
): void {
  // populated in later tasks
}
