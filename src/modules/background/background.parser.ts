import type { BackgroundEntity } from "./background.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { backgroundEntitySchema } from "./background.schema";

export function parseBackground(source: string): ParseResult<BackgroundEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug"]);
  if (!raw.success) return raw;

  const result = backgroundEntitySchema.safeParse({ edition: "2014", ...raw.data });
  if (!result.success) {
    return { success: false, error: `background schema validation failed: ${result.error.message}` };
  }
  return { success: true, data: result.data };
}
