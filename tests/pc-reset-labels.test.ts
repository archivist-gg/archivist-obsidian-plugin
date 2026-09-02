import { describe, it, expect } from "vitest";
import { RESET_LABELS, CUSTOM_RESET_TIP } from "../packages/obsidian/src/modules/pc/components/actions/reset-labels";

// R4-G3a §8.2 (vi) / §8.3: ONE `ResetTrigger`-keyed recovery-label table for
// features. It replaces TWO maps that disagreed: `feature-rows.ts`'s
// `RESET_TO_RECOVERY` bucket hop (dusk → "Long Rest"; turn/round/custom →
// "Special") and `feature-card.ts`'s `RESET_LABEL` twin. A `toEqual` key-set
// pin, not per-key `in`-presence: a table that gained or lost a key must fail.

describe("RESET_LABELS · the single recovery-label table (R4-G3a §8.2)", () => {
  it("maps every ResetTrigger to its caption, and nothing else", () => {
    expect(RESET_LABELS).toEqual({
      "short-rest": "Short Rest",
      "long-rest": "Long Rest",
      either: "Short or Long Rest",
      dawn: "Dawn",
      dusk: "Dusk",
      turn: "Per Turn",
      round: "Per Round",
      custom: "Special",
    });
  });

  it("carries the one custom-recovery tooltip string", () => {
    expect(CUSTOM_RESET_TIP).toBe("Recovery is described in this feature's text");
  });
});
