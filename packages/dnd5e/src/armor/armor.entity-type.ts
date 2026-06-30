import type { EntityType } from "@archivist/core";
import { armorCodec } from "./armor.codec";

export const armorEntityType: EntityType = {
  type: "armor",
  doc: armorCodec,
};
