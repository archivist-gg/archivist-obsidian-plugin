import type { ActionCost } from "@archivist-gg/dnd5e/types/resource";
import { ACTION_COST_LABEL } from "../../../../shared/rendering/action-cost-label";

// R4-G3a §4.2.4: the label table left this module for `shared/rendering/action-cost-label.ts` so
// the row caption builder and the feat renderer read the same five strings; the local
// `export type ActionCost` alias retired onto the dnd5e declaration at the same time. The CLASS map
// stays here: it is this badge's own presentation, with no second reader.
const CLS: Record<ActionCost, string> = {
  "action": "cost-action",
  "bonus-action": "cost-bonus",
  "reaction": "cost-reaction",
  "free": "cost-free",
  "special": "cost-special",
};

export function renderCostBadge(parent: HTMLElement, cost: ActionCost): HTMLElement {
  return parent.createDiv({ cls: `pc-cost-badge ${CLS[cost]}`, text: ACTION_COST_LABEL[cost] });
}
