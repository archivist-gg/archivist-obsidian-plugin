import * as yaml from "js-yaml";

const DND_LANGUAGES = new Set(["monster", "spell", "item"]);

export interface DndCodeFenceResult {
  entityType: string;
  name: string;
  data: Record<string, unknown>;
  yamlSource: string;
}

/**
 * Returns true if the code fence language is a D&D entity type.
 */
export function isDndCodeFence(language: string): boolean {
  return DND_LANGUAGES.has(language);
}

/**
 * Parses a D&D code fence's YAML content into a structured result.
 * Returns null if the YAML is invalid or missing a name field.
 */
export function parseDndCodeFence(language: string, yamlSource: string): DndCodeFenceResult | null {
  try {
    const data = yaml.load(yamlSource);
    if (!data || typeof data !== "object") return null;
    const record = data as Record<string, unknown>;
    const name = record.name;
    if (!name || typeof name !== "string") return null;
    return {
      entityType: language,
      name,
      data: record,
      yamlSource,
    };
  } catch {
    return null;
  }
}
