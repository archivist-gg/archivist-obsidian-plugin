import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EntityNote {
  slug: string;
  name: string;
  entityType: string;
  source: "srd" | "custom";
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// TYPE_FOLDER_MAP
// ---------------------------------------------------------------------------
export const TYPE_FOLDER_MAP: Record<string, string> = {
  monster: "Monsters",
  spell: "Spells",
  "magic-item": "Magic Items",
  armor: "Armor",
  weapon: "Weapons",
  feat: "Feats",
  condition: "Conditions",
  class: "Classes",
  background: "Backgrounds",
  item: "Items",
};

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
/**
 * Converts a display name to a URL/file-safe kebab-case slug.
 * "Ancient Red Dragon" -> "ancient-red-dragon"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // strip non-alphanumeric (except spaces & hyphens)
    .replace(/[\s]+/g, "-")        // spaces to hyphens
    .replace(/-{2,}/g, "-")        // collapse multiple hyphens
    .replace(/^-+|-+$/g, "");      // trim leading/trailing hyphens
}

// ---------------------------------------------------------------------------
// ensureUniqueSlug
// ---------------------------------------------------------------------------
/**
 * Returns the slug unchanged if it is not in existingSlugs.
 * Otherwise appends -custom, -custom-2, -custom-3, etc. until unique.
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingSlugs: Set<string>,
): string {
  if (!existingSlugs.has(baseSlug)) return baseSlug;

  const candidate = `${baseSlug}-custom`;
  if (!existingSlugs.has(candidate)) return candidate;

  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-custom-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-custom-${counter}`;
}

// ---------------------------------------------------------------------------
// generateEntityMarkdown
// ---------------------------------------------------------------------------
/**
 * Produces a complete Obsidian markdown note with YAML frontmatter
 * for an entity. The frontmatter carries the `archivist: true` flag
 * so we can identify our notes later.
 */
export function generateEntityMarkdown(entity: EntityNote): string {
  const frontmatter: Record<string, unknown> = {
    archivist: true,
    entity_type: entity.entityType,
    slug: entity.slug,
    name: entity.name,
    source: entity.source,
    data: entity.data,
  };

  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,       // don't wrap long lines
    noRefs: true,        // don't use YAML anchors
    sortKeys: false,     // preserve insertion order
  });

  // Build a simple body summary from the data
  const body = buildBodySummary(entity);

  return `---\n${yamlStr}---\n# ${entity.name}\n${body}`;
}

// ---------------------------------------------------------------------------
// parseEntityFrontmatter
// ---------------------------------------------------------------------------
/**
 * Parses an Obsidian note and returns an EntityNote if it has
 * `archivist: true` frontmatter. Returns null otherwise.
 */
export function parseEntityFrontmatter(content: string): EntityNote | null {
  if (!content || !content.startsWith("---\n")) return null;

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return null;

  const yamlBlock = content.substring(4, endIndex);

  let parsed: Record<string, unknown>;
  try {
    parsed = yaml.load(yamlBlock) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.archivist !== true) return null;

  const slug = parsed.slug;
  const name = parsed.name;
  const entityType = parsed.entity_type;
  const source = parsed.source;
  const data = parsed.data;

  if (
    typeof slug !== "string" ||
    typeof name !== "string" ||
    typeof entityType !== "string" ||
    (source !== "srd" && source !== "custom")
  ) {
    return null;
  }

  return {
    slug,
    name,
    entityType,
    source,
    data: (data && typeof data === "object" ? data : {}) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a short descriptive body for the note below the heading.
 * This is best-effort -- different entity types have different fields.
 */
function buildBodySummary(entity: EntityNote): string {
  const d = entity.data;
  const parts: string[] = [];

  switch (entity.entityType) {
    case "monster": {
      const descriptors = [d.size, d.type, d.alignment].filter(Boolean).join(", ");
      if (descriptors) parts.push(`*${descriptors}*`);
      const statLine = [
        d.ac != null ? `AC ${d.ac}` : null,
        d.hp != null ? `HP ${d.hp}` : null,
        d.cr != null ? `CR ${d.cr}` : null,
      ].filter(Boolean).join(" | ");
      if (statLine) parts.push(statLine);
      break;
    }
    case "spell": {
      const meta = [
        d.level != null ? `Level ${d.level}` : "Cantrip",
        d.school,
      ].filter(Boolean).join(", ");
      if (meta) parts.push(`*${meta}*`);
      break;
    }
    default: {
      // Generic: list key-value pairs
      const entries = Object.entries(d).filter(
        ([k]) => k !== "slug" && k !== "name",
      );
      if (entries.length > 0) {
        const line = entries
          .slice(0, 4)
          .map(([k, v]) => `**${k}:** ${v}`)
          .join(" | ");
        parts.push(line);
      }
      break;
    }
  }

  return parts.length > 0 ? `\n${parts.join("\n\n")}\n` : "";
}
