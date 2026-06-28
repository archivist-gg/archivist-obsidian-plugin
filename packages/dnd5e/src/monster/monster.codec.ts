import yaml from "js-yaml";
import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";

export type MonsterRaw = Record<string, unknown>;

/**
 * INTENTIONAL raw passthrough codec.
 *
 * `parse`/`serialize` are a semantically lossless round-trip: the YAML body is
 * decoded to a plain object and re-encoded as-is. This codec deliberately drops
 * nothing and normalizes nothing — display- and edit-mode normalization (e.g.
 * coercing/canonicalizing fields) is owned by the renderer / `parseMonster`,
 * not by the codec layer.
 *
 * Future entity codecs should make a conscious choice between this
 * raw-passthrough contract and a normalizing contract, rather than copying this
 * one by default.
 */
export const monsterCodec: DocCodec<MonsterRaw> = {
  parse(doc: EntityDoc): ParseResult<MonsterRaw> {
    try {
      const obj = yaml.load(doc.body);
      if (!obj || typeof obj !== "object") return { success: false, error: "monster body is not a mapping" };
      if (!(obj as Record<string, unknown>).name) return { success: false, error: "monster requires a name" };
      return { success: true, data: obj as MonsterRaw };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
  serialize(raw: MonsterRaw): string {
    return yaml.dump(raw, { lineWidth: -1, sortKeys: false });
  },
};
