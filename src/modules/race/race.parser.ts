import type { RaceEntity } from "./race.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { raceEntitySchema } from "./race.schema";

export function parseRace(source: string): ParseResult<RaceEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug", "edition"]);
  if (!raw.success) return raw;

  const result = raceEntitySchema.safeParse(raw.data);
  if (!result.success) {
    return { success: false, error: `race schema validation failed: ${result.error.message}` };
  }
  return { success: true, data: result.data as RaceEntity };
}
