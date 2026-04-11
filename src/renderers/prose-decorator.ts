/**
 * Wrap bare dice notation (e.g. `1d6`, `2d6+3`, `37d8 + 259`) in synthetic
 * `dice:…` backtick tags so the existing stat-block pill renderer picks them up.
 *
 * Skips dice notation that is already inside a backtick tag (lookbehind) or
 * embedded inside an identifier (word-character boundary).
 *
 * Pure. No state. No side effects.
 */
export function decorateProseDice(text: string): string {
  return text.replace(
    /(?<![`\w])(\d+d\d+(?:\s*[+-]\s*\d+)?)(?![`\w])/g,
    (match) => `\`dice:${match.replace(/\s+/g, "")}\``,
  );
}
