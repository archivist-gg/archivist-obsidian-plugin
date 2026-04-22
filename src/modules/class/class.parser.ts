import type { ClassEntity } from "./class.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { classEntitySchema } from "./class.schema";

export function parseClass(source: string): ParseResult<ClassEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug", "edition"]);
  if (!raw.success) return raw;

  const result = classEntitySchema.safeParse(raw.data);
  if (!result.success) {
    return { success: false, error: `class schema validation failed: ${result.error.message}` };
  }
  return { success: true, data: result.data as ClassEntity };
}
