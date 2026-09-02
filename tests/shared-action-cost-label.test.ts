import { describe, it, expect } from "vitest";
import { ACTION_COST_LABEL, costLabel } from "../packages/obsidian/src/shared/rendering/action-cost-label";

// R4-G3a §4.2.4 · the action-cost label table moved out of `cost-badge.ts`'s module-private
// `LABEL` into `shared/rendering/` so the caption builder (§4) and the feat renderer (§10.2.3)
// read ONE table. These rows are the same five strings `tests/pc-actions-cost-badge.test.ts`
// pins on the badge; asserted here on the table itself so a value change is red at the source,
// not only through a rendered badge.
describe("costLabel", () => {
  it("labels every action cost", () => {
    expect(costLabel("action")).toBe("Action");
    expect(costLabel("bonus-action")).toBe("Bonus");
    expect(costLabel("reaction")).toBe("Reaction");
    expect(costLabel("free")).toBe("Free");
    expect(costLabel("special")).toBe("Special");
  });

  it("ACTION_COST_LABEL is exactly the five-entry table", () => {
    expect(ACTION_COST_LABEL).toEqual({
      "action": "Action",
      "bonus-action": "Bonus",
      "reaction": "Reaction",
      "free": "Free",
      "special": "Special",
    });
  });
});
