// ---------------------------------------------------------------------------
// base-item resolver
// ---------------------------------------------------------------------------
//
// Magic items in canonical SRD bundles store their underlying weapon/armor as
// a vault-path wikilink, e.g. `base_item: "[[SRD 5e/Weapons/Longsword]]"`.
// The registry, however, is keyed by compendium-prefixed slug
// (e.g. `srd-5e_longsword`). Three downstream call sites (pc.equipment.ts,
// inventory-row.ts, inventory-row-expand.ts) all need to bridge that gap;
// without a shared helper they each rolled their own (inconsistent and broken)
// derivation. This module is the single source of truth.
//
// The helper accepts:
//   - vault-path wikilinks      `[[SRD 5e/Weapons/Longsword]]`
//   - aliased wikilinks         `[[SRD 5e/Weapons/Longsword|Longsword]]`
//   - bare-slug wikilinks       `[[srd-5e_longsword]]`  (legacy)
//   - bare slugs                `srd-5e_longsword`      (legacy/fixtures)
//
// and looks the result up in the supplied EntityRegistry. The compendium
// folder is slugified (matching how compendium-manager.ts builds its prefix)
// so non-SRD compendiums (e.g. "Homebrew/Weapons/CustomSword" -> `homebrew_...`)
// resolve through the same path.
// ---------------------------------------------------------------------------

import type { EntityRegistry, RegisteredEntity } from "./entity-registry";
import { slugify } from "./entity-vault-store";

/**
 * Strip surrounding `[[ ]]` and any `|alias` suffix. Returns the inner target
 * string, or null if the input has no wikilink wrapping (caller should treat
 * that as an already-bare slug).
 */
function unwrapWikilink(input: string): string | null {
  const m = /^\[\[([^\]]+)\]\]$/.exec(input.trim());
  if (!m) return null;
  const inner = m[1];
  // Drop the alias portion: "Foo|Bar" -> "Foo".
  const pipe = inner.indexOf("|");
  return pipe === -1 ? inner : inner.slice(0, pipe);
}

/**
 * Convert a vault-path target (e.g. `SRD 5e/Weapons/Longsword`) to a
 * registry-compatible slug (`srd-5e_longsword`). For a bare basename without
 * any `/`, returns the slugified basename - which lets legacy wikilinks like
 * `[[longsword]]` continue to resolve when registered under that bare slug.
 */
function vaultPathToSlug(target: string): string {
  const segments = target.split("/").map((s) => s.trim()).filter((s) => s.length > 0);
  if (segments.length === 0) return "";
  if (segments.length === 1) {
    // Bare basename - could already be a slug like `srd-5e_longsword`, or a
    // human-readable name like `Longsword`. Normalize via slugify so the
    // human form (`longsword`) resolves; existing bare slugs survive
    // because slugify is idempotent on lowercase-hyphenated input.
    return slugify(segments[0]);
  }
  const compendiumName = segments[0];
  const basename = segments[segments.length - 1];
  const prefix = slugify(compendiumName);
  const nameSlug = slugify(basename);
  return prefix && nameSlug ? `${prefix}_${nameSlug}` : nameSlug;
}

/**
 * Public: take a `base_item` string (vault-path wikilink, alias-form
 * wikilink, bare-slug wikilink, or bare slug) and return the matching
 * `RegisteredEntity` or null.
 *
 * - Empty / null / non-string input -> null
 * - String that doesn't unwrap to a slug -> null
 * - Slug not present in the registry -> null
 *
 * The lookup is type-agnostic: callers that need to narrow to a specific
 * `entityType` (e.g. "weapon" only) should branch on the result's
 * `entityType`. A type-narrowed convenience wrapper is also exported for the
 * common weapon/armor cases.
 */
export function resolveBaseItem(
  baseItem: string | null | undefined,
  registry: EntityRegistry,
): RegisteredEntity | null {
  if (typeof baseItem !== "string" || baseItem.length === 0) return null;
  const target = unwrapWikilink(baseItem) ?? baseItem.trim();
  if (target.length === 0) return null;
  // If the unwrapped target has no path separator, it might already be a
  // registered slug (including compendium-prefixed slugs like
  // `srd-5e_longsword` whose underscore would be stripped by slugify). Try
  // direct lookup first; only fall back to slugify normalization on miss.
  if (!target.includes("/")) {
    const direct = registry.getBySlug(target);
    if (direct) return direct;
  }
  const slug = vaultPathToSlug(target);
  if (!slug) return null;
  return registry.getBySlug(slug) ?? null;
}

/**
 * Convenience: resolve and require a specific entityType. Returns null if
 * the entry resolves but is the wrong type.
 */
export function resolveBaseItemOfType(
  baseItem: string | null | undefined,
  entityType: string,
  registry: EntityRegistry,
): RegisteredEntity | null {
  const found = resolveBaseItem(baseItem, registry);
  return found && found.entityType === entityType ? found : null;
}
