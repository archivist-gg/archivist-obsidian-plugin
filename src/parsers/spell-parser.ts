import { Spell } from "../types/spell";
import { ParseResult, parseYaml } from "./yaml-utils";

export function parseSpell(source: string): ParseResult<Spell> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const spell: Spell = {
    name: String(raw.name),
  };

  if (raw.level != null) spell.level = Number(raw.level);
  if (raw.school != null) spell.school = String(raw.school);
  if (raw.casting_time != null) spell.casting_time = String(raw.casting_time);
  if (raw.range != null) spell.range = String(raw.range);
  if (raw.components != null) spell.components = String(raw.components);
  if (raw.duration != null) spell.duration = String(raw.duration);
  if (raw.concentration != null) spell.concentration = Boolean(raw.concentration);
  if (raw.ritual != null) spell.ritual = Boolean(raw.ritual);
  if (Array.isArray(raw.classes)) spell.classes = raw.classes.map(String);
  if (Array.isArray(raw.description)) spell.description = raw.description.map(String);
  if (Array.isArray(raw.at_higher_levels)) spell.at_higher_levels = raw.at_higher_levels.map(String);

  return { success: true, data: spell };
}
