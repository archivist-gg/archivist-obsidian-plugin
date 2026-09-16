/**
 * Strip the authored markup out of a prose string so it can go into a plain-text host
 * (a `setTooltip` body, a `title` attribute) that renders no markdown (R4-G3a §4.3).
 *
 * The inputs are effect qualifiers and feature prose as the converter emitted them, which is
 * mixed-register sentences carrying wikilinks and emphasis · `"While *concentrating*"`,
 * `"…wielding a [[Player's Handbook (2024)/Magic Items/Shield|Shield]]"`. A tooltip shows those
 * markers literally, so they are removed rather than rendered.
 *
 * Order is load-bearing, in three stages:
 *   1. LINKS first · piped wikilinks resolve to their ALIAS, then bare ones to the last path
 *      segment (the file name, which is the display name a reader expects · never the full vault
 *      path), so a marker character inside a link target cannot be eaten before the link resolves.
 *   2. Code spans.
 *   3. DOUBLE markers (`**strong**`, `__strong__`) BEFORE single ones. Reversed, the single-`*`
 *      pass turns `**Bloodied**` into `*Bloodied*` and stops · measured on the pre-fix body, which
 *      also left `__strong__` as `_strong_`. Running double first makes the nested `***very***`
 *      case fall out too: the strong pass leaves `*very*` and the emphasis pass finishes it.
 *
 * The single-underscore pass is deliberately BOUNDED (`(^|[\s(])_…_(?=[\s.,;:)]|$)`) so it fires
 * only on word-boundary emphasis. An unbounded `_…_` ate the inner underscores of snake_case
 * identifiers · measured: `"a saving_throw_bonus field"` came out as `"a savingthrowbonus field"`,
 * silently corrupting any qualifier that quotes a field name. Asterisk emphasis needs no such
 * guard: `*` does not occur inside identifiers.
 *
 * This is display-side stripping ONLY. It parses nothing and evaluates nothing; it is a fixed
 * sequence of replacements, not a markdown parser. Constructs outside the shapes listed above are
 * passed through as authored rather than guessed at · a lone `_`, `a_b`, and an unpaired marker
 * all survive untouched (all measured, and the pairs above are pinned row-by-row in
 * tests/shared-plain-text.test.ts).
 */
export function plainText(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_m, p: string) => p.split("/").pop() ?? p)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s.,;:)]|$)/g, "$1$2");
}
