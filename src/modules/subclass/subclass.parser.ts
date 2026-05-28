import type { SubclassEntity } from "./subclass.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { subclassEntitySchema } from "./subclass.schema";

export function parseSubclass(source: string): ParseResult<SubclassEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug", "parent_class"]);
  if (!raw.success) return raw;

  const result = subclassEntitySchema.safeParse({ edition: "2014", ...raw.data });
  if (!result.success) {
    return { success: false, error: `subclass schema validation failed: ${result.error.message}` };
  }
  return { success: true, data: result.data as SubclassEntity };
}
