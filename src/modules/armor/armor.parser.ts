import type { ArmorEntity } from "./armor.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { armorEntitySchema } from "./armor.schema";

const KNOWN_KEYS = new Set([
  "name", "slug", "category", "ac",
  "strength_requirement", "stealth_disadvantage",
  "weight", "cost", "rarity",
  "source", "page", "edition",
  "entries", "raw",
]);

export function parseArmor(source: string): ParseResult<ArmorEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug", "category", "ac"]);
  if (!raw.success) return raw;

  const result = armorEntitySchema.safeParse(raw.data);
  if (!result.success) {
    return { success: false, error: `armor schema validation failed: ${result.error.message}` };
  }

  const entity = result.data as ArmorEntity;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.data)) {
    if (!KNOWN_KEYS.has(k)) extras[k] = v;
  }
  if (Object.keys(extras).length > 0) {
    entity.raw = { ...(entity.raw ?? {}), ...extras };
  }

  return { success: true, data: entity };
}
