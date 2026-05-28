import { Item } from "./item.types";
import { ParseResult, parseYaml } from "../../shared/parsers/yaml-utils";
import { itemEntitySchema } from "./item.schema";

const KNOWN_KEYS = new Set([
  "name", "slug", "type", "rarity",
  "base_item",
  "bonuses",
  "resist", "immune", "vulnerable", "condition_immune",
  "charges", "attached_spells", "attunement",
  "grants", "container", "light",
  "cursed", "sentient", "focus", "tier",
  "damage", "weapon_category", "armor_category",
  "weight", "cost",
  "source", "page", "edition",
  "description", "entries", "effects", "raw",
  // Legacy fields kept (removed in Slice 7 after grep verifies no consumer)
  "damage_dice", "damage_type", "properties", "recharge", "curse",
]);

function migrateAttunement(raw: Record<string, unknown>): void {
  // The new canonical attunement shape is { required, restriction?, tags? }.
  // Legacy YAML uses boolean | string. Auto-promote so downstream sees
  // the canonical shape consistently.
  //
  // Also handle the older top-level `requires_attunement: true` field, which
  // some pre-canonical-pipeline vaults still ship: if the canonical
  // `attunement` field is absent, synthesize it from the boolean. If both
  // exist, the structured `attunement` wins (don't override). The legacy
  // field is dropped from `raw` either way so it doesn't fall through into
  // the parsed entity's `raw` extras as untyped noise.
  const legacy = raw.requires_attunement;
  if (raw.attunement === undefined && typeof legacy === "boolean") {
    raw.attunement = { required: legacy };
  }
  if (legacy !== undefined) {
    delete raw.requires_attunement;
  }

  const v = raw.attunement;
  if (v === undefined || v === null) return;
  if (typeof v === "object" && !Array.isArray(v)) return; // already canonical
  if (typeof v === "boolean") {
    raw.attunement = { required: v };
  } else if (typeof v === "string") {
    raw.attunement = { required: true, restriction: v };
  }
}

export function parseItem(source: string): ParseResult<Item> {
  const raw = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!raw.success) return raw;

  migrateAttunement(raw.data);

  const result = itemEntitySchema.safeParse(raw.data);
  if (!result.success) {
    return { success: false, error: `item schema validation failed: ${result.error.message}` };
  }

  const entity = result.data as unknown as Item;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.data)) {
    if (!KNOWN_KEYS.has(k)) extras[k] = v;
  }
  if (Object.keys(extras).length > 0) {
    entity.raw = { ...(entity.raw ?? {}), ...extras };
  }

  return { success: true, data: entity };
}
