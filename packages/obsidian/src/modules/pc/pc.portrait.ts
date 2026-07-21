/**
 * Portrait domain constants + pure link-value normalization for the PC
 * portrait feature. Zero imports, no Obsidian API — callers own vault I/O
 * and settings.
 */

/** Frontmatter key that stores the raw portrait link value on a PC note. */
export const PORTRAIT_KEY = "archivist-portrait";

/** Extensions accepted as a portrait image (lowercase, no leading dot). */
export const PORTRAIT_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "avif",
  "bmp",
]);

const WIKI_LINK = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;
const MARKDOWN_LINK = /^!?\[[^\]]*\]\(([^)]+)\)$/;
const REMOTE_URL = /^https?:\/\//i;

/**
 * Normalizes a raw frontmatter link value into a vault-relative (or bare)
 * path. Handles Obsidian wiki links (`[[path]]`, `[[path|alias]]`, embed
 * `![[path]]`) and markdown links (`[text](url)`, `![text](url)`, URL
 * percent-decoded). Remote `http(s)://` targets and empty values yield
 * `null`; anything else passes through trimmed.
 */
export function normalizeLinkValue(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const wikiMatch = trimmed.match(WIKI_LINK);
  if (wikiMatch) return wikiMatch[1].trim();

  const mdMatch = trimmed.match(MARKDOWN_LINK);
  if (mdMatch) {
    const url = mdMatch[1];
    if (REMOTE_URL.test(url)) return null;
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  }

  if (REMOTE_URL.test(trimmed)) return null;
  return trimmed;
}

/** Setting-independent Obsidian wiki link for `linktext`. */
export function wikiLinkFor(linktext: string): string {
  return `[[${linktext}]]`;
}
