import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { WeaponEntity } from "./weapon.types";
import { parseWeapon } from "./weapon.parser";

/**
 * Normalizing codec (0c.1a). `parse` delegates to `parseWeapon`, which lifts
 * embedded-string `properties` (e.g. `versatile (1d10)`, `thrown (range
 * 20/60)`) into structured fields, validates against `weaponEntitySchema`
 * (injecting the `properties: []` default), and captures any unknown top-level
 * keys into `entity.raw`. `serialize` stays `yaml.dump` (the edit-save path
 * uses obsidian's separate serializer; gate (d) verifies `yaml.dump`
 * round-trips through `parseWeapon`).
 */
export const weaponCodec: DocCodec<WeaponEntity> = {
  parse(doc: EntityDoc): ParseResult<WeaponEntity> {
    return parseWeapon(doc.body);
  },
  serialize(entity: WeaponEntity): string {
    return yaml.dump(entity, { lineWidth: -1, sortKeys: false });
  },
};
