import type { WeaponEntity, WeaponProperty } from "./weapon.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { weaponEntitySchema } from "./weapon.schema";

const KNOWN_KEYS = new Set([
  "name", "slug", "category", "damage",
  "properties", "range", "reload", "mastery",
  "type_tags", "ammo_type",
  "weight", "cost",
  "source", "page", "edition",
  "entries", "raw",
]);

const FLAG_PROPERTIES = new Set([
  "finesse", "light", "heavy", "two_handed", "reach", "special",
  "thrown", "ammunition", "versatile", "loading",
]);

const VERSATILE_RE = /^versatile\s*\(\s*(\d+d\d+)\s*\)$/i;
const THROWN_RE = /^thrown\s*\(\s*range\s+(\d+)\s*\/\s*(\d+)\s*\)$/i;
const AMMUNITION_RE = /^ammunition\s*\(\s*range\s+(\d+)\s*\/\s*(\d+)\s*\)$/i;

interface ExtractedPropertyData {
  properties: WeaponProperty[];
  versatile_dice?: string;
  range?: { normal: number; long: number };
  unparsed: string[];
}

function extractFromPropertyStrings(input: unknown): ExtractedPropertyData {
  const out: ExtractedPropertyData = { properties: [], unparsed: [] };
  if (!Array.isArray(input)) return out;

  for (const raw of input) {
    if (typeof raw !== "string") {
      // Conditional-property objects pass through unchanged.
      out.properties.push(raw as WeaponProperty);
      continue;
    }

    const lower = raw.toLowerCase().trim();

    if (FLAG_PROPERTIES.has(lower)) {
      out.properties.push(lower as WeaponProperty);
      continue;
    }

    const v = lower.match(VERSATILE_RE);
    if (v) {
      out.properties.push("versatile");
      out.versatile_dice = v[1];
      continue;
    }

    const t = lower.match(THROWN_RE);
    if (t) {
      out.properties.push("thrown");
      out.range = { normal: Number.parseInt(t[1], 10), long: Number.parseInt(t[2], 10) };
      continue;
    }

    const a = lower.match(AMMUNITION_RE);
    if (a) {
      out.properties.push("ammunition");
      out.range = { normal: Number.parseInt(a[1], 10), long: Number.parseInt(a[2], 10) };
      continue;
    }

    out.unparsed.push(raw);
  }
  return out;
}

export function parseWeapon(source: string): ParseResult<WeaponEntity> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name", "slug", "category", "damage"]);
  if (!raw.success) return raw;

  // If properties[] contains embedded-data strings, lift them into structured fields.
  const propsInput = raw.data.properties;
  if (Array.isArray(propsInput)) {
    const extracted = extractFromPropertyStrings(propsInput);
    raw.data.properties = extracted.properties;
    if (extracted.versatile_dice && raw.data.damage && typeof raw.data.damage === "object") {
      const dmg = raw.data.damage as Record<string, unknown>;
      if (dmg.versatile_dice === undefined) dmg.versatile_dice = extracted.versatile_dice;
    }
    if (extracted.range && raw.data.range === undefined) {
      raw.data.range = extracted.range;
    }
    if (extracted.unparsed.length > 0) {
      const existingRaw = (raw.data.raw as Record<string, unknown> | undefined) ?? {};
      existingRaw.unparsed_properties = extracted.unparsed;
      raw.data.raw = existingRaw;
    }
  }

  const result = weaponEntitySchema.safeParse(raw.data);
  if (!result.success) {
    return { success: false, error: `weapon schema validation failed: ${result.error.message}` };
  }

  const entity = result.data as WeaponEntity;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.data)) {
    if (!KNOWN_KEYS.has(k)) extras[k] = v;
  }
  if (Object.keys(extras).length > 0) {
    entity.raw = { ...(entity.raw ?? {}), ...extras };
  }

  return { success: true, data: entity };
}
