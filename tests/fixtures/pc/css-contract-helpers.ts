/**
 * Shared helpers for the CSS-source contract suites (`pc-css-contracts-g6b.test.ts`, `pc-css-contracts-g7.test.ts`).
 *
 * R4-G7 wave A fix round 1 (review Minor 4): the g7 suite sliced a `@container` block at the first `"\n}"`, which only
 * worked because nested closing braces happen to be indented. The g6b suite already counted braces; that counter now
 * lives here and both suites read it.
 */

/** The whole `@container <query> { ... }` block, found by counting braces, or `null` when the partial has none. `query`
 *  is the text between `@container` and the opening brace. The FIRST block with that exact query is returned. */
export function containerBlockIn(css: string, query: string): string | null {
  const head = `@container ${query} {`;
  const start = css.indexOf(head);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start + head.length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`@container ${query} is unterminated`);
}
