import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { BackgroundEntity } from "./background.types";
import { parseBackground } from "./background.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseBackground`, which seeds
 * the `edition: "2014"` default and validates against `backgroundEntitySchema`.
 * `serialize` stays `yaml.dump` (the edit-save path uses obsidian's separate
 * serializer; gate (d) verifies `yaml.dump` round-trips through `parseBackground`).
 */
export const backgroundCodec: DocCodec<BackgroundEntity> = {
  parse(doc: EntityDoc): ParseResult<BackgroundEntity> {
    return parseBackground(doc.body);
  },
  serialize(entity: BackgroundEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
