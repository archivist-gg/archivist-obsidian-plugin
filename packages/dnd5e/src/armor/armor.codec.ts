import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { ArmorEntity } from "./armor.types";
import { parseArmor } from "./armor.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseArmor`, which validates
 * against `armorEntitySchema` (injecting the `ac.flat`/`ac.add_con`/`ac.add_wis`
 * defaults) and captures any unknown top-level keys into `entity.raw`.
 * `serialize` stays `yaml.dump` (the edit-save path uses obsidian's separate
 * serializer; gate (d) verifies `yaml.dump` round-trips through `parseArmor`).
 */
export const armorCodec: DocCodec<ArmorEntity> = {
  parse(doc: EntityDoc): ParseResult<ArmorEntity> {
    return parseArmor(doc.body);
  },
  serialize(entity: ArmorEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
