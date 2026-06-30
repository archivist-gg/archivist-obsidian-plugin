import type { EntityType } from "@archivist/core";
import { optionalFeatureCodec } from "./optional-feature.codec";

export const optionalFeatureEntityType: EntityType = {
  type: "optional-feature",
  doc: optionalFeatureCodec,
};
