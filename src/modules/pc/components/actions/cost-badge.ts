export type ActionCost = "action" | "bonus-action" | "reaction" | "free" | "special";

const LABEL: Record<ActionCost, string> = {
  "action": "Action",
  "bonus-action": "Bonus",
  "reaction": "Reaction",
  "free": "Free",
  "special": "Special",
};

const CLS: Record<ActionCost, string> = {
  "action": "cost-action",
  "bonus-action": "cost-bonus",
  "reaction": "cost-reaction",
  "free": "cost-free",
  "special": "cost-special",
};

export function renderCostBadge(parent: HTMLElement, cost: ActionCost): HTMLElement {
  return parent.createDiv({ cls: `pc-cost-badge ${CLS[cost]}`, text: LABEL[cost] });
}
