import type { SystemPack } from "@archivist/core";
import { CONVENTION_VERSION } from "@archivist/core";
import { monsterEntityType } from "./monster/monster.entity-type";
import { raceEntityType } from "./race/race.entity-type";
import { backgroundEntityType } from "./background/background.entity-type";
import { featEntityType } from "./feat/feat.entity-type";
import { optionalFeatureEntityType } from "./optional-feature/optional-feature.entity-type";
import { armorEntityType } from "./armor/armor.entity-type";
import { weaponEntityType } from "./weapon/weapon.entity-type";
import { classEntityType } from "./class/class.entity-type";
import { subclassEntityType } from "./subclass/subclass.entity-type";
import { spellEntityType } from "./spell/spell.entity-type";
import { itemEntityType } from "./item/item.entity-type";
import { npcEntityType } from "./npc/npc.entity-type";
import { encounterEntityType } from "./encounter/encounter.entity-type";

/**
 * The real `dnd5e` SystemPack. It owns the parse/resolve/generate contract for
 * D&D 5e entity types via their {@link EntityType} definitions; presentation
 * (renderer/edit/modal) stays in the obsidian package. It is the only pack the
 * kernel registers.
 *
 * All 11 authored types are ported, plus the two generate-only types (npc and
 * encounter); a new entity type joins by appending its EntityType here.
 */
export const dnd5ePack: SystemPack = {
  id: "dnd5e",
  version: "0.1.0",
  conventionVersion: CONVENTION_VERSION,
  entityTypes: [monsterEntityType, raceEntityType, backgroundEntityType, featEntityType, optionalFeatureEntityType, armorEntityType, weaponEntityType, classEntityType, subclassEntityType, spellEntityType, itemEntityType, npcEntityType, encounterEntityType],
};
