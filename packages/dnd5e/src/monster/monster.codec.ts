import yaml from "js-yaml";
import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";

export type MonsterRaw = Record<string, unknown>;

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
