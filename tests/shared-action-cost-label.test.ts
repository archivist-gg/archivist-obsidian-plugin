import { describe, it, expect } from "vitest";
import { ACTION_COST_LABEL, ACTION_COST_LONG_LABEL, costLabel, costLongLabel } from "../packages/obsidian/src/shared/rendering/action-cost-label";
import { COST_LABELS } from "../packages/obsidian/src/modules/pc/components/actions/entry-meta";

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

// R4-G7 T8 fix round 1 (W-D-D3): the LONG form of the same five costs, for text that names the economy (the row caption, the pool
// row sub-line, the block card's Cost meta). The badge keeps the short form above. The long strings moved here from `entry-meta.ts`,
// whose `COST_LABELS` is now this table, so one file holds both forms.
describe("costLongLabel", () => {
  it("ACTION_COST_LONG_LABEL is exactly the five-entry long table", () => {
    expect(ACTION_COST_LONG_LABEL).toEqual({
      "action": "Action",
      "bonus-action": "Bonus Action",
      "reaction": "Reaction",
      "free": "Free",
      "special": "Special",
    });
    expect(costLongLabel("bonus-action")).toBe("Bonus Action");
  });

  it("the pool row's COST_LABELS is the shared long table, not a second copy of its strings", () => {
    expect(COST_LABELS).toBe(ACTION_COST_LONG_LABEL);
  });
});
