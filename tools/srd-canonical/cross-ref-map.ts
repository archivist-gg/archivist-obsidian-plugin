/**
 * Cross-reference rewriter — stub.
 *
 * Task 10.1 will replace this with full source-marker → wikilink rewriting
 * (e.g., `{@spell fireball}` → `[[SRD 5e/Spells/Fireball|fireball]]`).
 *
 * For now: passthrough. Phase 8 merge rules can call it freely; once 10.1
 * lands, all merge output will gain proper cross-references retroactively.
 */
export function rewriteCrossRefs(text: string, _edition: "2014" | "2024"): string {
  return text;
}
