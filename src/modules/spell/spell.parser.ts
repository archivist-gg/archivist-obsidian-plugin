import { Spell, CastingOption } from "./spell.types";
import { ParseResult, parseYaml, toStringSafe } from "../../shared/parsers/yaml-utils";

export function parseSpell(source: string): ParseResult<Spell> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const spell: Spell = {
    name: toStringSafe(raw.name),
  };

  if (raw.level != null) spell.level = Number(raw.level);
  if (raw.school != null) spell.school = toStringSafe(raw.school);
  if (raw.casting_time != null) spell.casting_time = toStringSafe(raw.casting_time);
  if (raw.range != null) spell.range = toStringSafe(raw.range);
  if (raw.components != null) spell.components = toStringSafe(raw.components);
  if (raw.duration != null) spell.duration = toStringSafe(raw.duration);
  if (raw.concentration != null) spell.concentration = Boolean(raw.concentration);
  if (raw.ritual != null) spell.ritual = Boolean(raw.ritual);
  if (Array.isArray(raw.classes)) spell.classes = raw.classes.map(String);
  if (Array.isArray(raw.description)) spell.description = raw.description.map(String);
  if (Array.isArray(raw.at_higher_levels)) spell.at_higher_levels = raw.at_higher_levels.map(String);

  if (Array.isArray(raw.casting_options)) {
    spell.casting_options = (raw.casting_options as Array<Record<string, unknown>>).map(opt => {
      const co: CastingOption = { type: toStringSafe(opt.type) };
      if (typeof opt.damage_roll === "string") co.damage_roll = opt.damage_roll;
      if (typeof opt.target_count === "number") co.target_count = opt.target_count;
      if (typeof opt.duration === "string") co.duration = opt.duration;
      if (typeof opt.range === "number") co.range = opt.range;
      if (typeof opt.concentration === "boolean") co.concentration = opt.concentration;
      if (typeof opt.shape_size === "number") co.shape_size = opt.shape_size;
      if (typeof opt.desc === "string") co.desc = opt.desc;
      return co;
    });
  }

  return { success: true, data: spell };
}
