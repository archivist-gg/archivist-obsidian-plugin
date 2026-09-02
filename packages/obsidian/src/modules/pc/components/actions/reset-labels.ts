import type { ResetTrigger } from "@archivist-gg/dnd5e/types/resource";

/**
 * The ONE recovery-label table for FEATURE resources (R4-G3a §8.2 (vi), §8.3).
 *
 * It replaces two maps that disagreed: `feature-rows.ts`'s `RESET_TO_RECOVERY`
 * bucket hop into the item display vocabulary (which mislabelled `dusk` as
 * "Long Rest" and flattened `turn`/`round`/`custom` to "Special") and the
 * `RESET_LABEL` twin in `blocks/feature-card.ts` (read at the Arcane-Recovery
 * spent-hint). Both are retired onto this table.
 *
 * `Record<ResetTrigger, string>` is the exhaustiveness guard: adding a member to
 * dnd5e's `ResetTrigger` fails the build here until it gains a caption, which is
 * exactly the erasure §8.1 measured (every other reader is a `Record<string,…>`
 * with a fallback, so a new trigger reached the UI as silent nonsense).
 *
 * The persisted ITEM charge vocabulary (`dawn|short|long|special`) is a
 * DIFFERENT union and keeps its own four-member map in `charge-boxes.ts`
 * (invariant 4): two vocabularies reach the same caption site by construction.
 */
export const RESET_LABELS: Record<ResetTrigger, string> = {
  "short-rest": "Short Rest",
  "long-rest": "Long Rest",
  either: "Short or Long Rest",
  dawn: "Dawn",
  dusk: "Dusk",
  turn: "Per Turn",
  round: "Per Round",
  custom: "Special",
};

/** Tooltip for a `custom` recovery: the cadence is prose on the feature itself
 *  (already rendered on the expand card), so the caption says only "Special". */
export const CUSTOM_RESET_TIP = "Recovery is described in this feature's text";
