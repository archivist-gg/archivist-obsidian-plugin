import { Spell } from "./spell.types";
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

  return { success: true, data: spell };
}
