import type { EntityType } from "@archivist/core";
import { classCodec } from "./class.codec";

export const classEntityType: EntityType = {
  type: "class",
  doc: classCodec,
};
