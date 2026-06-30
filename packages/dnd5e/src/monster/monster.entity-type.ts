import type { EntityType } from "@archivist/core";
import { monsterCodec } from "./monster.codec";
import { resolveMonster } from "./monster.resolve";
import { monsterGeneratable } from "./monster.generatable";
import type { Monster } from "./monster.types";

export const monsterEntityType: EntityType = {
  type: "monster",
  doc: monsterCodec,
  resolve: (raw, ctx) => resolveMonster(raw as Monster, ctx),
  generatable: monsterGeneratable,
};
