// slug-core.mjs
// ---------------------------------------------------------------------------
// Pure, dependency-free slug helpers shared by the P1 homebrew migration
// (Task 8) and Task 9. No filesystem, no side effects — trivially testable.
//
// The 3-part type-namespaced slug convention is:
//   `${slugify(compendium)}_${entity_type}_${slugify(name)}`
// e.g. MCDM class "Illrigger"  -> "mcdm_class_illrigger"
//      MCDM boon  "Bedevil"    -> "mcdm_optional-feature_bedevil"
//      DMG  item  "Ring of Evasion" -> "dmg-2024_item_ring-of-evasion"

/**
 * The 12 canonical entity-type tokens that may appear as the middle segment
 * of a migrated slug. Used by `isMigrated`/`parseSlug` to distinguish an
 * already-3-part slug from a bare/2-part legacy slug.
 */
export const TYPES = [
  "armor",
  "weapon",
  "item",
  "spell",
  "monster",
  "class",
  "subclass",
  "background",
  "race",
  "feat",
  "optional-feature",
  "condition",
];

/**
 * Convert a display name to a URL/file-safe kebab-case slug.
 *
 * This is a BYTE-FOR-BYTE port of the app's `slugify`
 * (`@archivist-gg/dnd5e/entities/slug` — src/entities/slug.ts) so that slugs
 * computed here are IDENTICAL to what the generator produces. In particular
 * the app STRIPS every char that is not `[a-z0-9\s-]` (apostrophes, commas,
 * parentheses, `&`, `_`, ...) rather than replacing it with a hyphen — e.g.
 * "Sonya, the Ascendant Stargate" -> "sonya-the-ascendant-stargate" (comma
 * dropped with no extra hyphen), "Acheron's Chain" -> "acherons-chain".
 *
 * @param {string} name
 * @returns {string}
 */
export const slugifyName = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // strip non-alphanumeric (except spaces & hyphens)
    .replace(/[\s]+/g, "-") // spaces to hyphens
    .replace(/-{2,}/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

/**
 * Slugify a compendium display name into its prefix token.
 * "MCDM" -> "mcdm", "DMG 2024" -> "dmg-2024",
 * "Eberron - Forge of the Artificer" -> "eberron-forge-of-the-artificer",
 * "Me" -> "me".
 *
 * @param {string} compendium
 * @returns {string}
 */
export const compendiumPrefix = (compendium) => slugifyName(compendium);

/**
 * Compute the 3-part type-namespaced slug from an entity's OWN frontmatter.
 * Never parses the old slug string — bare-prefix legacy slugs (e.g. MCDM boon
 * "bedevil") carry nothing to parse.
 *
 * @param {{compendium: string, entityType: string, name: string}} args
 * @returns {string}
 */
export const computeNewSlug = ({ compendium, entityType, name }) =>
  `${compendiumPrefix(compendium)}_${entityType}_${slugifyName(name)}`;

/**
 * Split a slug into its underscore-delimited parts plus a structured view.
 * `type`/`name` are only populated when the slug is already migrated
 * (3+ parts whose 2nd part is a known entity type). Shared with Task 9.
 *
 * @param {string} slug
 * @returns {{raw: string, parts: string[], migrated: boolean, prefix: string, type: string|null, name: string|null}}
 */
export const parseSlug = (slug) => {
  const raw = String(slug);
  const parts = raw.split("_");
  const migrated = parts.length >= 3 && TYPES.includes(parts[1]);
  return {
    raw,
    parts,
    migrated,
    prefix: parts[0] ?? "",
    type: migrated ? parts[1] : null,
    // name segment may itself contain underscores in theory; rejoin the tail.
    name: migrated ? parts.slice(2).join("_") : null,
  };
};

/**
 * A slug is already migrated iff it splits into >= 3 underscore-parts AND its
 * 2nd part is one of the 12 canonical entity types. Bare (`bedevil`) and
 * 2-part (`mcdm_illrigger`, `dmg-2024_ring-of-evasion`) legacy slugs return
 * false, so re-running the migration is a zero-diff no-op.
 *
 * @param {string} slug
 * @returns {boolean}
 */
export const isMigrated = (slug) => {
  const parts = String(slug).split("_");
  return parts.length >= 3 && TYPES.includes(parts[1]);
};
