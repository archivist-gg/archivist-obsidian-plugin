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
  character: Character,
  _resolved: ResolvedCharacter,
  derived: DerivedStats,
  _registry: EntityRegistry | null,
  type: RestType,
): RestPlan {
  const cats: RestCategory[] = [];

  if (type === "long") {
    if (character.state.hp.current < derived.hp.max) {
      cats.push({
        id: "hp-to-max",
        label: "Hit Points",
        preview: `${character.state.hp.current} → ${derived.hp.max}`,
      });
    }

    if (character.state.exhaustion > 0) {
      cats.push({
        id: "exhaustion",
        label: "Exhaustion",
        preview: `${character.state.exhaustion} → ${character.state.exhaustion - 1}`,
      });
    }

    const slotsUsed = Object.values(character.state.spell_slots ?? {})
      .reduce((s, slot) => s + (slot.used ?? 0), 0);
    if (slotsUsed > 0) {
      cats.push({ id: "spell-slots", label: "Spell Slots", preview: "all reset" });
    }
  }

  return { type, categories: cats, hdAvailable: [] };
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
