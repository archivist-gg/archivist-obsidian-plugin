import { Spell, CastingOption } from "./spell.types";
import { ParseResult, parseYaml, toStringSafe } from "../../shared/parsers/yaml-utils";
import { spellEntitySchema } from "./spell.schema";

const KNOWN_KEYS = new Set([
  "name", "level", "school", "casting_time", "range", "components", "duration",
  "concentration", "ritual", "classes", "description", "at_higher_levels",
  "damage", "saving_throw", "casting_options",
  // Body-only metadata that's emitted to YAML but ignored at runtime — accept silently.
  "slug", "edition", "source",
]);

export function parseSpell(source: string): ParseResult<Spell> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  // Strip body-only metadata before schema validation.
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result.data)) {
    if (k === "slug" || k === "edition" || k === "source") continue;
    if (!KNOWN_KEYS.has(k)) {
      return { success: false, error: `Unknown spell field: ${k}` };
    }
    filtered[k] = v;
  }

  const parsed = spellEntitySchema.safeParse(filtered);
  if (!parsed.success) {
    return { success: false, error: `spell schema validation failed: ${parsed.error.message}` };
  }

  // Coerce remaining shape (mostly identity now that schema validates).
  const raw = parsed.data;
  const spell: Spell = { name: raw.name };
  if (raw.level != null) spell.level = raw.level;
  if (raw.school != null) spell.school = toStringSafe(raw.school);
  if (raw.casting_time != null) spell.casting_time = toStringSafe(raw.casting_time);
  if (raw.range != null) spell.range = toStringSafe(raw.range);
  if (raw.components != null) spell.components = toStringSafe(raw.components);
  if (raw.duration != null) spell.duration = toStringSafe(raw.duration);
  if (raw.concentration != null) spell.concentration = Boolean(raw.concentration);
  if (raw.ritual != null) spell.ritual = Boolean(raw.ritual);
  if (raw.classes) spell.classes = raw.classes.map(String);
  if (raw.description) spell.description = raw.description;
  if (raw.at_higher_levels) spell.at_higher_levels = raw.at_higher_levels.map(String);
  if (raw.damage) spell.damage = { types: raw.damage.types.map(String) };
  if (raw.saving_throw) spell.saving_throw = { ability: raw.saving_throw.ability };
  if (raw.casting_options) {
    spell.casting_options = raw.casting_options.map(opt => {
      const co: CastingOption = { type: opt.type };
      if (opt.damage_roll !== undefined) co.damage_roll = opt.damage_roll;
      if (opt.target_count !== undefined) co.target_count = opt.target_count;
      if (opt.duration !== undefined) co.duration = opt.duration;
      if (opt.range !== undefined) co.range = opt.range;
      if (opt.concentration !== undefined) co.concentration = opt.concentration;
      if (opt.shape_size !== undefined) co.shape_size = opt.shape_size;
      if (opt.desc !== undefined) co.desc = opt.desc;
      return co;
    });
  }
  return { success: true, data: spell };
}
