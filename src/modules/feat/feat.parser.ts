import type { FeatEntity } from "./feat.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { featEntitySchema } from "./feat.schema";

export function parseFeat(source: string): ParseResult<FeatEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug"]);
  if (!raw.success) return raw;

  const result = featEntitySchema.safeParse({ edition: "2014", ...raw.data });
  if (!result.success) {
    return { success: false, error: `feat schema validation failed: ${result.error.message}` };
  }
  return { success: true, data: result.data };
}
