import type { EntityType } from "@archivist/core";
import { itemCodec } from "./item.codec";
import { itemGeneratable } from "./item.generatable";

export const itemEntityType: EntityType = {
  type: "item",
  doc: itemCodec,
  generatable: itemGeneratable,
};
