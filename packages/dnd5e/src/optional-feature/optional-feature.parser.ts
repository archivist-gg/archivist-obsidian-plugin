import type { OptionalFeatureEntity } from "@archivist/dnd5e/types/optional-feature.types";
import { ParseResult, parseYaml } from "@archivist/core";
import { optionalFeatureEntitySchema } from "./optional-feature.schema";

export function parseOptionalFeature(source: string): ParseResult<OptionalFeatureEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug", "feature_type"]);
  if (!raw.success) return raw;

  const result = optionalFeatureEntitySchema.safeParse({ edition: "2014", ...raw.data });
  if (!result.success) {
    return { success: false, error: `optional-feature schema validation failed: ${result.error.message}` };
  }
  return { success: true, data: result.data };
}
