import type { EntityType } from "@archivist/core";
import { monsterCodec } from "./monster.codec";
import { resolveMonster } from "./monster.resolve";

// NOTE: `generatable: monsterGeneratable` is intentionally omitted here.
// `monsterGeneratable` is created in Task 11, which will add the field to this
// EntityType (and the corresponding import) once `monster.generatable.ts` exists.
export const monsterEntityType: EntityType = {
  type: "monster",
  doc: monsterCodec,
  resolve: (raw, ctx) => resolveMonster(raw as Record<string, unknown>, ctx),
};
