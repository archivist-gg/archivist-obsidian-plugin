import {
  convertDescToTags,
  STATIC_FALLBACK_CONTEXT,
} from "../../shared/dnd/srd-tag-converter";
import type { Spell } from "./spell.types";

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
      convertDescToTags(p, STATIC_FALLBACK_CONTEXT),
    );
  }
  if (Array.isArray(enriched.at_higher_levels)) {
    enriched.at_higher_levels = enriched.at_higher_levels.map((p: string) =>
      convertDescToTags(p, STATIC_FALLBACK_CONTEXT),
    );
  }

  return enriched;
}
