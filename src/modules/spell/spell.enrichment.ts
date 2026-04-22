import {
  convertDescToTags,
  type ConversionContext,
} from "../../shared/dnd/srd-tag-converter";
import type { Spell } from "./spell.types";

/**
 * Dummy context for spells: all ability mods = -5, prof = 0.
 * No computed target matches any reasonable value, so every pattern
 * falls to the static fallback path (e.g. `dc:15`).
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
