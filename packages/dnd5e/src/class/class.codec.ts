import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { ClassEntity } from "./class.types";
import { parseClass } from "./class.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseClass`, which validates
 * against `classEntitySchema`. `class.types` is this entity's dnd5e home for
 * `SpellcastingConfig`/`ClassEntity` (consumed by PC + all subclass files).
 * `serialize` stays `yaml.dump` (the edit-save path uses obsidian's separate
 * serializer; gate (d) verifies `yaml.dump` round-trips through `parseClass`).
 */
export const classCodec: DocCodec<ClassEntity> = {
  parse(doc: EntityDoc): ParseResult<ClassEntity> {
    return parseClass(doc.body);
  },
  serialize(entity: ClassEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
