import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { OptionalFeatureEntity } from "@archivist/dnd5e/types/optional-feature.types";
import { parseOptionalFeature } from "./optional-feature.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseOptionalFeature`, which
 * seeds the `edition: "2014"` default and validates against
 * `optionalFeatureEntitySchema`. `serialize` stays `yaml.dump` (the edit-save
 * path uses obsidian's separate serializer; gate (d) verifies `yaml.dump`
 * round-trips through `parseOptionalFeature`).
 *
 * SPECIAL (0c.1a Task 7): the entity type already lives at
 * `@archivist/dnd5e/types/optional-feature.types` (moved in 0c.0), so the codec
 * imports it from there rather than a sibling `./optional-feature.types`.
 */
export const optionalFeatureCodec: DocCodec<OptionalFeatureEntity> = {
  parse(doc: EntityDoc): ParseResult<OptionalFeatureEntity> {
    return parseOptionalFeature(doc.body);
  },
  serialize(entity: OptionalFeatureEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
