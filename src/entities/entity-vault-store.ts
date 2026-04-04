import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EntityNote {
  slug: string;
  name: string;
  entityType: string;
  compendium: string;
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
 * Produces a complete Obsidian markdown note with minimal YAML frontmatter
 * (indexing fields only) and a fenced code block containing the entity YAML.
 * Opening the note in Obsidian renders the stat block directly.
 */
export function generateEntityMarkdown(entity: EntityNote): string {
  const frontmatter: Record<string, unknown> = {
    archivist: true,
    entity_type: entity.entityType,
    slug: entity.slug,
    name: entity.name,
    compendium: entity.compendium,
  };
  const fm = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const codeBlockType = entity.entityType === "magic-item" ? "item" : entity.entityType;
  const body = yaml.dump(entity.data, { lineWidth: -1, noRefs: true, sortKeys: false });
  return `---\n${fm}---\n\n\`\`\`${codeBlockType}\n${body}\`\`\`\n`;
}

// ---------------------------------------------------------------------------
// parseEntityFile
// ---------------------------------------------------------------------------
/**
 * Parses a new-format entity file: minimal frontmatter + fenced code block.
 * Returns EntityNote or null if the content doesn't match the new format.
 */
export function parseEntityFile(content: string): EntityNote | null {
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
  const compendium = parsed.compendium;

  if (
    typeof slug !== "string" ||
    typeof name !== "string" ||
    typeof entityType !== "string" ||
    typeof compendium !== "string"
  ) {
    return null;
  }

  // Extract fenced code block from body
  const bodyStart = endIndex + 4; // skip "\n---"
  const bodyContent = content.substring(bodyStart);
  const codeBlockMatch = bodyContent.match(/```\w+\n([\s\S]*?)```/);
  if (!codeBlockMatch) return null;

  let data: Record<string, unknown>;
  try {
    data = yaml.load(codeBlockMatch[1]) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!data || typeof data !== "object") return null;

  return {
    slug,
    name,
    entityType,
    compendium,
    data,
  };
}

// ---------------------------------------------------------------------------
// parseEntityFrontmatter
// ---------------------------------------------------------------------------
/**
 * Parses an Obsidian note and returns an EntityNote. Tries the new format
 * (fenced code block) first, then falls back to the old format (data in
 * frontmatter) for backward compatibility.
 */
export function parseEntityFrontmatter(content: string): EntityNote | null {
  // Try new format first
  const newResult = parseEntityFile(content);
  if (newResult) return newResult;

  // Fall back to old format (data blob in frontmatter)
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

  // Map old source values to compendium
  const compendium = source === "srd" ? "SRD" : "Homebrew";

  return {
    slug,
    name,
    entityType,
    compendium,
    data: (data && typeof data === "object" ? data : {}) as Record<string, unknown>,
  };
}
