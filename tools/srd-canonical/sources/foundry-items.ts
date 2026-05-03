// tools/srd-canonical/sources/foundry-items.ts
//
// Read foundry-items.json from the local structured-rules dump and index
// by slugified name + source, filtered to a single edition. The merger
// reconciler looks items up here when assembling conditional bonuses.

import * as fs from "node:fs";
import * as path from "node:path";
import { slugifyName } from "./slug-normalize";
import type { FoundryChange } from "./foundry-effects";

export interface FoundryEffect {
  name?: string;
  transfer?: boolean;
  changes?: FoundryChange[];
}

export interface FoundryItem {
  name: string;
  source: string;
  effects?: FoundryEffect[];
}

export type FoundryItemsIndex = Map<string, FoundryItem>;

function isSourceForEdition(source: string, edition: "2014" | "2024"): boolean {
  // Source-tag convention matches structured-rules.ts: PHB/MM/DMG/etc → 2014;
  // XPHB/XMM/XDMG/etc → 2024.
  if (edition === "2024") return source.startsWith("X");
  return !source.startsWith("X");
}

/**
 * Load foundry-items.json from the structured-rules dump root and return a
 * Map keyed by the item's slugified name. Filters to entries whose source
 * tag matches the requested edition.
 *
 * Returns an empty Map when the file is missing — callers that don't have
 * a STRUCTURED_RULES_PATH configured should still build successfully (just
 * without the foundry-derived enrichment).
 */
export function readFoundryItemsIndex(
  rootPath: string,
  edition: "2014" | "2024",
): FoundryItemsIndex {
  const filePath = path.join(rootPath, "foundry-items.json");
  if (!fs.existsSync(filePath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { item?: FoundryItem[] };
  const items = Array.isArray(raw.item) ? raw.item : [];
  const idx: FoundryItemsIndex = new Map();
  for (const item of items) {
    if (!item || typeof item.name !== "string" || typeof item.source !== "string") continue;
    if (!isSourceForEdition(item.source, edition)) continue;
    const slug = slugifyName(item.name);
    if (!idx.has(slug)) idx.set(slug, item);
  }
  return idx;
}
