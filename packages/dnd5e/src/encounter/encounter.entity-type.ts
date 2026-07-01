import type { EntityType } from "@archivist/core";
import { encounterGeneratable } from "./encounter.generatable";

export const encounterEntityType: EntityType = {
  type: "encounter",
  generatable: encounterGeneratable,
};
