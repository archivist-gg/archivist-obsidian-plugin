import type { Abilities } from "./abilities";
import type { EntityRegistry } from "../entities/entity-registry";

export interface FormulaContext {
  abilities: Abilities;
  proficiencyBonus: number;
  compendium?: EntityRegistry;
}
