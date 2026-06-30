import type { EntityType } from "@archivist/core";
import { spellCodec } from "./spell.codec";

export const spellEntityType: EntityType = {
  type: "spell",
  doc: spellCodec,
};
