import {
  convertDescToTags,
  type ConversionContext,
} from "../../shared/dnd/srd-tag-converter";
import type { Spell } from "../../types/spell";
import type { Item } from "../../types/item";

/**
 * Dummy context for spells/items: all ability mods = -5, prof = 0.
 * No computed target matches any reasonable value, so every pattern
 * falls to the static fallback path (e.g. `dc:15`, `atk:+7`).
 */
const STATIC_CONTEXT: ConversionContext = {
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  profBonus: 0,
  actionName: "",
  actionCategory: "trait",
};

export function enrichSpell(raw: Record<string, unknown>): Spell {
  const duration = raw.duration as string | undefined;
  const concentration =
    (raw.concentration as boolean) ??
    (duration?.toLowerCase().includes("concentration") ?? false);
  const classes = (raw.classes as string[])?.length
    ? (raw.classes as string[])
    : ["Wizard", "Sorcerer"];

  const enriched = {
    ...(raw as unknown as Spell),
    concentration,
    ritual: (raw.ritual as boolean) ?? false,
    classes,
  };

  // Safety net: convert any plain-English mechanics to backtick tags (static fallback)
  if (Array.isArray(enriched.description)) {
    enriched.description = enriched.description.map((p: string) =>
      convertDescToTags(p, STATIC_CONTEXT),
    );
  }
  if (Array.isArray(enriched.at_higher_levels)) {
    enriched.at_higher_levels = enriched.at_higher_levels.map((p: string) =>
      convertDescToTags(p, STATIC_CONTEXT),
    );
  }

  return enriched;
}

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
