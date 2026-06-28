import type { EntityType } from "@archivist/core";
import { monsterCodec } from "./monster.codec";
import { resolveMonster } from "./monster.resolve";
import { monsterGeneratable } from "./monster.generatable";

export const monsterEntityType: EntityType = {
  type: "monster",
  doc: monsterCodec,
  resolve: (raw, ctx) => resolveMonster(raw as Record<string, unknown>, ctx),
  generatable: monsterGeneratable,
};
