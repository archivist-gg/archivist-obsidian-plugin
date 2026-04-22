import {
  convertDescToTags,
  type ConversionContext,
} from "../../shared/dnd/srd-tag-converter";
import type { Item } from "./item.types";

/**
 * Dummy context for items: all ability mods = -5, prof = 0.
 * No computed target matches any reasonable value, so every pattern
 * falls to the static fallback path (e.g. `dc:15`, `atk:+7`).
 */
const STATIC_CONTEXT: ConversionContext = {
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  profBonus: 0,
  actionName: "",
  actionCategory: "trait",
};

export function enrichItem(
  raw: Record<string, unknown>,
): Item & { source?: string } {
  const enriched = {
    ...(raw as unknown as Item),
    source: (raw.source as string) ?? "Homebrew",
    attunement: raw.attunement ?? false,
    curse: (raw.curse as boolean) ?? false,
  } as Item & { source?: string };

  // Safety net: convert any plain-English mechanics to backtick tags (static fallback)
  if (Array.isArray(enriched.entries)) {
    enriched.entries = enriched.entries.map((e: string) =>
      convertDescToTags(e, STATIC_CONTEXT),
    );
  }

  return enriched;
}
