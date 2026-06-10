import type { Feature } from "../../shared/types/feature";
import type { Choice } from "../../shared/types/choice";

/** Fallback for un-annotated content (homebrew). Returns synthesized choices,
 *  "informational" for unmapped decision prose, or null for no decision.
 *  Real table lands in the recognizer task. */
export function recognizeDecision(_feature: Feature): Choice[] | "informational" | null {
  return null;
}
