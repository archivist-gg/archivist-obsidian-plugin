import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { RaceEntity } from "./race.types";
import { parseRace } from "./race.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseRace`, which seeds the
 * `edition: "2014"` default and validates against `raceEntitySchema`. `serialize`
 * stays `yaml.dump` (the edit-save path uses obsidian's separate serializer; gate
 * (d) verifies `yaml.dump` round-trips through `parseRace`).
 */
export const raceCodec: DocCodec<RaceEntity> = {
  parse(doc: EntityDoc): ParseResult<RaceEntity> {
    return parseRace(doc.body);
  },
  serialize(entity: RaceEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
