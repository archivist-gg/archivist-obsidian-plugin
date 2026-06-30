import type { EntityType } from "@archivist/core";
import { itemCodec } from "./item.codec";

export const itemEntityType: EntityType = {
  type: "item",
  doc: itemCodec,
};
