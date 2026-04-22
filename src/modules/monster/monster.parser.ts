import { Monster } from "./monster.types";
import { ParseResult, parseYaml, toStringSafe } from "../../shared/parsers/yaml-utils";

export function parseMonster(source: string): ParseResult<Monster> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const monster: Monster = {
    name: toStringSafe(raw.name),
  };

  if (raw.size != null) monster.size = toStringSafe(raw.size);
  if (raw.type != null) monster.type = toStringSafe(raw.type);
  if (raw.subtype != null) monster.subtype = toStringSafe(raw.subtype);
  if (raw.alignment != null) monster.alignment = toStringSafe(raw.alignment);
  if (raw.cr != null) monster.cr = toStringSafe(raw.cr);

  if (Array.isArray(raw.ac)) {
    monster.ac = raw.ac.map((entry: Record<string, unknown>) => ({
      ac: Number(entry.ac),
      from: Array.isArray(entry.from) ? entry.from.map(String) : undefined,
    }));
  }

  if (raw.hp && typeof raw.hp === "object") {
    const hp = raw.hp as Record<string, unknown>;
    monster.hp = {
      average: Number(hp.average),
      formula: hp.formula != null ? toStringSafe(hp.formula) : undefined,
    };
  }

  if (raw.speed && typeof raw.speed === "object") {
    const speed = raw.speed as Record<string, unknown>;
    monster.speed = {};
    for (const key of ["walk", "fly", "swim", "climb", "burrow"] as const) {
      if (speed[key] != null) monster.speed[key] = Number(speed[key]);
    }
  }

  if (raw.abilities && typeof raw.abilities === "object") {
    const ab = raw.abilities as Record<string, unknown>;
    monster.abilities = {
      str: Number(ab.str ?? 10),
      dex: Number(ab.dex ?? 10),
      con: Number(ab.con ?? 10),
      int: Number(ab.int ?? 10),
      wis: Number(ab.wis ?? 10),
      cha: Number(ab.cha ?? 10),
    };
  }

  if (raw.saves && typeof raw.saves === "object") {
    const saves: Partial<Record<string, number>> = {};
    for (const [key, val] of Object.entries(raw.saves as Record<string, unknown>)) {
      saves[key] = Number(val);
    }
    monster.saves = saves;
  }

  if (raw.skills && typeof raw.skills === "object") {
    const skills: Record<string, number> = {};
    for (const [key, val] of Object.entries(raw.skills as Record<string, unknown>)) {
      skills[key] = Number(val);
    }
    monster.skills = skills;
  }

  if (Array.isArray(raw.senses)) monster.senses = raw.senses.map(String);
  if (raw.passive_perception != null) monster.passive_perception = Number(raw.passive_perception);
  if (Array.isArray(raw.languages)) monster.languages = raw.languages.map(String);
  if (Array.isArray(raw.damage_vulnerabilities)) monster.damage_vulnerabilities = raw.damage_vulnerabilities.map(String);
  if (Array.isArray(raw.damage_resistances)) monster.damage_resistances = raw.damage_resistances.map(String);
  if (Array.isArray(raw.damage_immunities)) monster.damage_immunities = raw.damage_immunities.map(String);
  if (Array.isArray(raw.condition_immunities)) monster.condition_immunities = raw.condition_immunities.map(String);

  const parseFeatures = (arr: unknown): { name: string; entries: string[] }[] | undefined => {
    if (!Array.isArray(arr)) return undefined;
    return arr.map((f: Record<string, unknown>) => ({
      name: toStringSafe(f.name),
      entries: Array.isArray(f.entries) ? f.entries.map(String) : [],
    }));
  };

  monster.traits = parseFeatures(raw.traits);
  monster.actions = parseFeatures(raw.actions);
  monster.reactions = parseFeatures(raw.reactions);
  monster.legendary = parseFeatures(raw.legendary);

  if (raw.legendary_actions != null) monster.legendary_actions = Number(raw.legendary_actions);
  if (raw.legendary_resistance != null) monster.legendary_resistance = Number(raw.legendary_resistance);
  if (raw.columns != null) monster.columns = Number(raw.columns);

  // Extract Legendary Resistance count from traits if not explicitly set.
  // SRD data stores it as a trait named "Legendary Resistance (3/Day)" rather
  // than a separate numeric field.
  if (!monster.legendary_resistance && monster.traits) {
    const lrIndex = monster.traits.findIndex(t =>
      /^Legendary Resistance\s*\(/i.test(t.name ?? "")
    );
    if (lrIndex !== -1) {
      const match = monster.traits[lrIndex].name?.match(/\((\d+)\/Day\)/i);
      if (match) {
        monster.legendary_resistance = parseInt(match[1], 10);
        monster.traits.splice(lrIndex, 1);
      }
    }
  }

  return { success: true, data: monster };
}
