import type { EntityType } from "@archivist/core";
import { subclassCodec } from "./subclass.codec";

export const subclassEntityType: EntityType = {
  type: "subclass",
  doc: subclassCodec,
};
