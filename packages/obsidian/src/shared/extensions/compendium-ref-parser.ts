export interface CompendiumRef {
  entityType: string | null;
  slug: string;
}

const VALID_TYPES = new Set([
  "monster", "spell", "item", "feat", "condition",
  "class", "background", "armor", "weapon",
]);

export function parseCompendiumRef(text: string): CompendiumRef | null {
  const match = text.match(/^\{\{\s*(.+?)\s*\}\}$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner) return null;
  const colonIdx = inner.indexOf(":");
  if (colonIdx === -1) return { entityType: null, slug: inner };
  const prefix = inner.substring(0, colonIdx).trim();
  const slug = inner.substring(colonIdx + 1).trim();
  if (!slug) return null;
  if (!VALID_TYPES.has(prefix)) return { entityType: null, slug: inner };
  return { entityType: prefix, slug };
}
