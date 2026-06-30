import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { FeatEntity } from "./feat.types";
import { parseFeat } from "./feat.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseFeat`, which seeds the
 * `edition: "2014"` default and validates against `featEntitySchema`.
 * `serialize` stays `yaml.dump` (the edit-save path uses obsidian's separate
 * serializer; gate (d) verifies `yaml.dump` round-trips through `parseFeat`).
 */
export const featCodec: DocCodec<FeatEntity> = {
  parse(doc: EntityDoc): ParseResult<FeatEntity> {
    return parseFeat(doc.body);
  },
  serialize(entity: FeatEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
