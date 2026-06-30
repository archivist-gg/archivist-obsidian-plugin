import type { SystemPack } from "@archivist/core";
import { CONVENTION_VERSION } from "@archivist/core";
import { monsterEntityType } from "./monster/monster.entity-type";
import { raceEntityType } from "./race/race.entity-type";
import { backgroundEntityType } from "./background/background.entity-type";

/**
 * The real `dnd5e` SystemPack. It owns the parse/resolve/generate contract for
 * D&D 5e entity types via their {@link EntityType} definitions; presentation
 * (renderer/edit/modal) stays in the obsidian package. Registered ahead of the
 * legacy strangler pack so its EntityTypes win for any type it declares.
 *
 * Currently exposes the monster vertical slice (Plan A); further entity types
 * migrate off the legacy adapter by appending their EntityType here.
 */
export const dnd5ePack: SystemPack = {
  id: "dnd5e",
  version: "0.1.0",
  conventionVersion: CONVENTION_VERSION,
  entityTypes: [monsterEntityType, raceEntityType, backgroundEntityType],
};
