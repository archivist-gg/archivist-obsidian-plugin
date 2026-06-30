import type { EntityType } from "@archivist/core";
import { weaponCodec } from "./weapon.codec";

export const weaponEntityType: EntityType = {
  type: "weapon",
  doc: weaponCodec,
};
