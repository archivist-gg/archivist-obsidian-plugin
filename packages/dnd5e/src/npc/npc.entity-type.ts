import type { EntityType } from "@archivist/core";
import { npcGeneratable } from "./npc.generatable";

export const npcEntityType: EntityType = {
  type: "npc",
  generatable: npcGeneratable,
};
