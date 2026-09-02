/**
 * R4-G3a §4.2.4 · the ONE action-cost label table.
 *
 * These five strings were module-private in `pc/components/actions/cost-badge.ts`, which put them
 * out of reach of every other surface that has to name an action cost. Rather than copy them (the
 * defect class invariant 3 names: one vocabulary, several declarations, and they drift), the table
 * lives here in `shared/rendering/` and `cost-badge.ts` imports it. Its other readers are the row
 * caption builder for `extra-action` (§4) and the feat renderer (§10.2.3).
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
