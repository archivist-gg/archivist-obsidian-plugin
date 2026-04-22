import * as yaml from "js-yaml";

export type ParseResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

export function parseYaml<T>(source: string, requiredFields: string[]): ParseResult<T> {
  try {
    const data = yaml.load(source) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid YAML: expected an object" };
    }
    for (const field of requiredFields) {
      if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === "") {
        return { success: false, error: `Missing required field: ${field}` };
      }
    }
    return { success: true, data: data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `YAML parse error: ${msg}` };
  }
}

export { abilityModifier, formatModifier } from "../dnd/math";

/**
 * Convert an unknown value to a string without producing "[object Object]".
 * Primitives pass through. Objects and arrays are JSON-stringified.
 * null and undefined return the empty string.
 */
export function toStringSafe(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
