import type { EntityType } from "@archivist/core";
import { backgroundCodec } from "./background.codec";

export const backgroundEntityType: EntityType = {
  type: "background",
  doc: backgroundCodec,
};
