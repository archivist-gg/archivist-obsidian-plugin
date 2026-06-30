import yaml from "js-yaml";
import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import type { Monster } from "./monster.types";
import { parseMonster } from "./monster.parser";

/** Deprecated alias kept for the barrel re-export (`index.ts:7`) + `monster.resolve.ts:2`. */
export type MonsterRaw = Monster; // N2: mandatory, not conditional

/**
 * Normalizing codec (0c.1a B8). `parse` delegates to `parseMonster`, which maps
 * the `legendary` alias and extracts Legendary-Resistance from trait text into the
 * canonical `legendary_resistance` field. This canonicalization is intended and
 * persists on save (B3); resolve-derived PB/XP are NOT added here. `serialize` stays
 * `yaml.dump` (the edit-save path uses obsidian's separate `editableToYaml` — document
 * that two-serializer split here; gate (d) Step 6 verifies `yaml.dump` round-trips).
 */
export const monsterCodec: DocCodec<Monster> = {
  parse(doc: EntityDoc): ParseResult<Monster> {
    return parseMonster(doc.body);
  },
  serialize(monster: Monster): string {
    return yaml.dump(monster, { lineWidth: -1, sortKeys: false });
  },
};
