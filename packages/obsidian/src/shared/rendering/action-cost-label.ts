/**
 * R4-G3a §4.2.4 · the ONE action-cost label table.
 *
 * These five strings were module-private in `pc/components/actions/cost-badge.ts`, which put them
 * out of reach of every other surface that has to name an action cost. Rather than copy them (the
 * defect class invariant 3 names: one vocabulary, several declarations, and they drift), the table
 * lives here in `shared/rendering/` and `cost-badge.ts` imports it. Its other reader is the feat renderer
 * (§10.2.3); the row caption builder for `extra-action` (§4) reads the LONG form below since R4-G7 T8 fix round 1.
 *
 * `shared/rendering/*` imports nothing from `modules/`, and this keeps it that way: the key type is
 * `ActionCost` as the RULES declare it (dnd5e `types/resource`), not a plugin-local re-spelling, so
 * a widened cost is a compile error here rather than a missing label at render time.
 */
import type { ActionCost } from "@archivist-gg/dnd5e/types/resource";

export const ACTION_COST_LABEL: Record<ActionCost, string> = {
  "action": "Action",
  "bonus-action": "Bonus",
  "reaction": "Reaction",
  "free": "Free",
  "special": "Special",
};

export const costLabel = (c: ActionCost): string => ACTION_COST_LABEL[c];

/**
 * R4-G7 T8 fix round 1 (W-D-D3) · the LONG form of the same five costs, for text that names the economy in a sentence-like line:
 * the row caption for `extra-action` (`+1 Bonus Action`; the short form cut it to `+1 Bonus` where `+1 Action` reads whole), the
 * pool row sub-line and the block card's Cost meta. The short table above stays the badge's (a fixed-width chip) and the feat
 * renderer's. These strings MOVED here from `pc/components/actions/entry-meta.ts` `COST_LABELS`, which now IS this table, so both
 * forms of the one vocabulary live in one file.
 */
export const ACTION_COST_LONG_LABEL: Record<ActionCost, string> = {
  "action": "Action",
  "bonus-action": "Bonus Action",
  "reaction": "Reaction",
  "free": "Free",
  "special": "Special",
};

export const costLongLabel = (c: ActionCost): string => ACTION_COST_LONG_LABEL[c];
