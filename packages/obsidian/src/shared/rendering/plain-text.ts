/**
 * Strip the authored markup out of a prose string so it can go into a plain-text host
 * (a `setTooltip` body, a `title` attribute) that renders no markdown (R4-G3a §4.3).
 *
 * The inputs are effect qualifiers and feature prose as the converter emitted them, which is
 * mixed-register sentences carrying wikilinks and emphasis · `"While *concentrating*"`,
 * `"…wielding a [[Player's Handbook (2024)/Magic Items/Shield|Shield]]"`. A tooltip shows those
 * markers literally, so they are removed rather than rendered.
 *
 * Order is load-bearing: piped wikilinks resolve to their ALIAS first, then bare ones to the last
 * path segment (the file name, which is the display name a reader expects · never the full vault
 * path), and only then do code spans and emphasis come off, so a `*` inside a link target cannot
 * be eaten before the link is resolved.
 *
 * This is display-side stripping ONLY. It parses nothing, evaluates nothing, and is not a markdown
 * renderer · a nested or malformed construct is left as it is rather than guessed at.
 */
export function plainText(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_m, p: string) => p.split("/").pop() ?? p)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}
