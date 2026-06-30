import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { SubclassEntity } from "./subclass.types";
import { parseSubclass } from "./subclass.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseSubclass`, which validates
 * against `subclassEntitySchema`. `subclass.types` is this entity's dnd5e home for
 * `SubclassEntity` (consumed by the PC resolver/types); its `Edition`/`SpellcastingConfig`
 * imports resolve dnd5e-internally from `class.types`. `serialize` stays `yaml.dump`
 * (the edit-save path uses obsidian's separate serializer; gate (d) verifies `yaml.dump`
 * round-trips through `parseSubclass`).
 */
export const subclassCodec: DocCodec<SubclassEntity> = {
  parse(doc: EntityDoc): ParseResult<SubclassEntity> {
    return parseSubclass(doc.body);
  },
  serialize(entity: SubclassEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
