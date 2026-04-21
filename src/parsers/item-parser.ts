import { Item } from "../types/item";
import { ParseResult, parseYaml, toStringSafe } from "./yaml-utils";

export function parseItem(source: string): ParseResult<Item> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const item: Item = {
    name: toStringSafe(raw.name),
  };

  if (raw.type != null) item.type = toStringSafe(raw.type);
  if (raw.rarity != null) item.rarity = toStringSafe(raw.rarity);
  if (raw.attunement != null && raw.attunement !== null) {
    if (typeof raw.attunement === "boolean") {
      item.attunement = raw.attunement;
    } else if (typeof raw.attunement === "string") {
      item.attunement = raw.attunement;
    }
  }
  if (raw.weight != null) item.weight = Number(raw.weight);
  if (raw.value != null) item.value = Number(raw.value);
  if (raw.damage != null) item.damage = toStringSafe(raw.damage);
  if (raw.damage_type != null) item.damage_type = toStringSafe(raw.damage_type);
  if (Array.isArray(raw.properties)) item.properties = raw.properties.map(String);
  if (raw.charges != null && raw.charges !== null) item.charges = Number(raw.charges);
  if (raw.recharge != null && raw.recharge !== null) item.recharge = toStringSafe(raw.recharge);
  if (raw.curse != null) item.curse = Boolean(raw.curse);
  if (Array.isArray(raw.entries)) item.entries = raw.entries.map(String);

  return { success: true, data: item };
}
