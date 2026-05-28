/**
 * Cherry-picked Tabler icon SVGs registered via Obsidian's addIcon() API.
 *
 * Tabler icons use a 0 0 24 24 viewBox; Obsidian's addIcon expects inner SVG
 * content for a 0 0 100 100 viewBox but handles the scaling internally.
 *
 * Source: @tabler/icons (outline set)
 */
import { addIcon } from 'obsidian';

/**
 * Map of icon-name to inner SVG content (no outer <svg> wrapper, no transparent
 * background rect).
 */
const TABLER_ICONS: Record<string, string> = {
  'tabler-wand': `<path d="M6 21l15 -15l-3 -3l-15 15l3 3" /><path d="M15 6l3 3" /><path d="M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" /><path d="M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />`,

  'tabler-flask': `<path d="M9 3l6 0" /><path d="M10 9l4 0" /><path d="M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6" />`,

  'tabler-scroll': `<path d="M17 20h-11a3 3 0 0 1 0 -6h11a3 3 0 0 0 0 6h1a3 3 0 0 0 3 -3v-11a2 2 0 0 0 -2 -2h-10a2 2 0 0 0 -2 2v8" />`,

  'tabler-crystal-ball': `<path d="M6.73 17.018a8 8 0 1 1 10.54 0" /><path d="M5 19a2 2 0 0 0 2 2h10a2 2 0 1 0 0 -4h-10a2 2 0 0 0 -2 2" /><path d="M11 7a3 3 0 0 0 -3 3" />`,

  'tabler-feather': `<path d="M4 20l10 -10m0 -5v5h5m-9 -1v5h5m-9 -1v5h5m-5 -5l4 -4l4 -4" /><path d="M19 10c.638 -.636 1 -1.515 1 -2.486a3.515 3.515 0 0 0 -3.517 -3.514c-.97 0 -1.847 .367 -2.483 1m-3 13l4 -4l4 -4" />`,

  'tabler-sword': `<path d="M20 4v5l-9 7l-4 4l-3 -3l4 -4l7 -9l5 0" /><path d="M6.5 11.5l6 6" />`,

  'tabler-campfire': `<path d="M4 21l16 -4" /><path d="M20 21l-16 -4" /><path d="M12 15a4 4 0 0 0 4 -4c0 -3 -2 -3 -2 -8c-4 2 -6 5 -6 8a4 4 0 0 0 4 4" />`,

  'tabler-chess-knight': `<path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v2.382h12v-2.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8" /><path d="M9 3l1 3l-3.491 2.148a1 1 0 0 0 .524 1.852h2.967l-2.073 6h7.961l.112 -5c0 -3 -1.09 -5.983 -4 -7c-1.94 -.678 -2.94 -1.011 -3 -1" />`,

  'tabler-door': `<path d="M14 12v.01" /><path d="M3 21h18" /><path d="M6 21v-16a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16" />`,

  'tabler-old-key': `<path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0" /><path d="M15 9h.01" />`,

  // Custom Tabler-style outline (no first-party `ring.svg` exists in @tabler/icons).
  // A finger ring: circular band with a triangular gem on top.
  'tabler-ring': `<path d="M6 16a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" /><path d="M9 7l3 -4l3 4" />`,

  // Source: @tabler/icons outline → baseline.svg
  'tabler-baseline': `<path d="M4 20h16" /><path d="M8 16v-8a4 4 0 1 1 8 0v8" /><path d="M8 10h8" />`,

  // Source: @tabler/icons outline → needle.svg
  'tabler-needle': `<path d="M3 21c-.667 -.667 3.262 -6.236 11.785 -16.709a3.5 3.5 0 1 1 5.078 4.791c-10.575 8.612 -16.196 12.585 -16.863 11.918" /><path d="M17.5 6.5l-1 1" />`,
};

/**
 * Register all cherry-picked Tabler icons with Obsidian so they can be
 * referenced by name (e.g. `setIcon(el, 'tabler-wand')`).
 *
 * Call once during plugin initialization.
 */
export function registerTablerIcons(): void {
  for (const [name, svgContent] of Object.entries(TABLER_ICONS)) {
    addIcon(name, svgContent);
  }
}
