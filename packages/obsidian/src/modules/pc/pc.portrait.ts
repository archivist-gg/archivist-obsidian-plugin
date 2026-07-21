/**
 * Portrait domain constants + pure helpers for the PC portrait feature:
 * frontmatter link normalization, square-crop math, and the portraits
 * folder path. Zero imports, no Obsidian API - callers own vault I/O and
 * settings; where a settings shape is needed it is a structural param
 * (never the real settings type), so this module stays standalone and
 * trivially unit-testable.
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

/** Frontmatter key that stores the raw square-crop value on a PC note. */
export const PORTRAIT_CROP_KEY = "archivist-portrait-crop";

/** A square crop region expressed as fractions of the displayed image width. */
export interface CropParams {
  x: number;
  y: number;
  size: number;
}

/** Tolerance for comparing crop fractions (e.g. detecting "still the default cover crop"). */
export const CROP_EPSILON = 0.005;

const strip = (s?: string) => (s ?? "").replace(/^\/+|\/+$/g, "");

/**
 * Resolves the vault folder that stores imported portrait images. An
 * explicit `portraitsFolder` (slashes stripped) wins outright; otherwise
 * falls back to `<playerCharactersFolder or "PlayerCharacters">/Portraits`.
 * Slashes are stripped before the emptiness check, so `"/"` counts as unset.
 */
export function getPortraitsFolder(
  settings: { portraitsFolder?: string; playerCharactersFolder?: string } | undefined,
): string {
  const explicit = strip(settings?.portraitsFolder);
  if (explicit.length > 0) return explicit;
  const pcFolder = strip(settings?.playerCharactersFolder) || "PlayerCharacters";
  return `${pcFolder}/Portraits`;
}

/**
 * Parses a stored crop value ("x,y,size" as fractions of display width).
 * Lenient about whitespace; rejects non-finite parts, non-positive size,
 * negative x/y, and x+size beyond 1 (within `CROP_EPSILON`). `y` may exceed
 * 1 (tall images can crop below the first square viewport).
 */
export function parseCropValue(raw: string): CropParams | null {
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.length !== 3) return null;
  const [x, y, size] = parts.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return null;
  if (size <= 0) return null;
  if (x < 0 || y < 0) return null;
  if (x + size > 1 + CROP_EPSILON) return null;
  return { x, y, size };
}

/** Formats a crop as a 4-decimal CSV string, the inverse of `parseCropValue`. */
export function formatCropValue(c: CropParams): string {
  return `${c.x.toFixed(4)},${c.y.toFixed(4)},${c.size.toFixed(4)}`;
}

/**
 * Default "cover" crop for an image displayed at `dispW` x `dispH`: the
 * largest centered square, expressed as fractions of `dispW` (width-referenced,
 * matching `marqueeToCrop` and `cropCssProps`).
 */
export function coverCrop(dispW: number, dispH: number): CropParams {
  const m = Math.min(dispW, dispH);
  return {
    x: (dispW - m) / 2 / dispW,
    y: (dispH - m) / 2 / dispW,
    size: m / dispW,
  };
}

/**
 * Converts a marquee selection (top-left `mx,my` and side length `side`, all
 * in the same on-screen pixel units as the displayed image) into a crop,
 * by dividing every component by the displayed width `dispW`.
 */
export function marqueeToCrop(mx: number, my: number, side: number, dispW: number): CropParams {
  return { x: mx / dispW, y: my / dispW, size: side / dispW };
}

/**
 * True when `c` matches the default cover crop for `dispW` x `dispH` within
 * `CROP_EPSILON`, compared component-by-component (not a combined distance).
 */
export function isCoverCrop(c: CropParams, dispW: number, dispH: number): boolean {
  const cover = coverCrop(dispW, dispH);
  return (
    Math.abs(c.x - cover.x) <= CROP_EPSILON &&
    Math.abs(c.y - cover.y) <= CROP_EPSILON &&
    Math.abs(c.size - cover.size) <= CROP_EPSILON
  );
}

/**
 * CSS custom properties for rendering a crop: a scale factor (`--pc-crop-w`,
 * width relative to the crop's square) and an offset (`--pc-crop-x/y`, also
 * relative to the crop's square) that together position the source image
 * inside a fixed square frame.
 */
export function cropCssProps(c: CropParams): Record<string, string> {
  return {
    "--pc-crop-w": String(1 / c.size),
    "--pc-crop-x": String(c.x / c.size),
    "--pc-crop-y": String(c.y / c.size),
  };
}
