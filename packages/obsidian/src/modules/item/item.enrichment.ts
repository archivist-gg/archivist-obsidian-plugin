import {
  convertDescToTags,
  STATIC_FALLBACK_CONTEXT,
} from "../../shared/dnd/srd-tag-converter";
import type { Item } from "./item.types";

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
      convertDescToTags(e, STATIC_FALLBACK_CONTEXT),
    );
  }

  return enriched;
}
