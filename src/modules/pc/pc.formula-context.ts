import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { FormulaContext } from "../../shared/types/formula-context";
import type { DerivedStats, ResolvedCharacter } from "./pc.types";

export function buildFormulaContext(
  resolved: ResolvedCharacter,
  derived: DerivedStats,
  registry: EntityRegistry,
): FormulaContext {
  return {
    abilities: resolved.definition.abilities,
    proficiencyBonus: derived.proficiencyBonus,
    compendium: registry,
  };
}
