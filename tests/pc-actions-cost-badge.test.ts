/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderCostBadge, type ActionCost } from "../src/modules/pc/components/actions/cost-badge";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderCostBadge", () => {
  const cases: Array<[ActionCost, string, string]> = [
    ["action",       "Action",   "cost-action"],
    ["bonus-action", "Bonus",    "cost-bonus"],
    ["reaction",     "Reaction", "cost-reaction"],
    ["free",         "Free",     "cost-free"],
    ["special",      "Special",  "cost-special"],
  ];

  it.each(cases)("renders %s as label %s with class %s", (cost, label, cls) => {
    const root = mountContainer();
    renderCostBadge(root, cost);
    const badge = root.querySelector(".pc-cost-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe(label);
    expect(badge?.classList.contains(cls)).toBe(true);
  });
});
