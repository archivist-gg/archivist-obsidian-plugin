import type { Abilities } from "./abilities";
import type { EntityRegistry } from "../entities/entity-registry";

export interface FormulaContext {
  abilities: Abilities;
  profBonus: number;
  compendium?: EntityRegistry;
}
