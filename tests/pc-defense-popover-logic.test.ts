// tests/pc-defense-popover-logic.test.ts
import { describe, it, expect } from "vitest";
import {
  cycleAction,
  defenseKindFor,
  type DefenseRowState,
  type TappedPip,
} from "../packages/obsidian/src/modules/pc/components/defense-type-popover-logic";

describe("cycleAction", () => {
  // Neutral row — tapping any pip is an add-only.
  it.each<[TappedPip]>([["resistance"], ["immunity"], ["vulnerability"]])(
    "neutral row, tap %s → add-only",
    (pip) => {
      expect(cycleAction(null, pip)).toEqual({ addKind: pip });
    },
  );

  // Tapping the active pip clears (remove-only).
  it.each<[DefenseRowState]>([["resistance"], ["immunity"], ["vulnerability"]])(
    "active row, tap same → remove-only (%s)",
    (kind) => {
      expect(cycleAction(kind, kind as TappedPip)).toEqual({ removeKind: kind });
    },
  );

  // Tapping a different pip swaps.
  it("resistance → tap I → swap to immunity", () => {
    expect(cycleAction("resistance", "immunity")).toEqual({
      removeKind: "resistance",
      addKind: "immunity",
    });
  });

  it("resistance → tap V → swap to vulnerability", () => {
    expect(cycleAction("resistance", "vulnerability")).toEqual({
      removeKind: "resistance",
      addKind: "vulnerability",
    });
  });

  it("immunity → tap R → swap to resistance", () => {
    expect(cycleAction("immunity", "resistance")).toEqual({
      removeKind: "immunity",
      addKind: "resistance",
    });
  });

  it("immunity → tap V → swap to vulnerability", () => {
    expect(cycleAction("immunity", "vulnerability")).toEqual({
      removeKind: "immunity",
      addKind: "vulnerability",
    });
  });

  it("vulnerability → tap R → swap to resistance", () => {
    expect(cycleAction("vulnerability", "resistance")).toEqual({
      removeKind: "vulnerability",
      addKind: "resistance",
    });
  });

  it("vulnerability → tap I → swap to immunity", () => {
    expect(cycleAction("vulnerability", "immunity")).toEqual({
      removeKind: "vulnerability",
      addKind: "immunity",
    });
  });
});

describe("defenseKindFor", () => {
  it("maps each pip kind to the storage kind", () => {
    expect(defenseKindFor("resistance")).toBe("resistances");
    expect(defenseKindFor("immunity")).toBe("immunities");
    expect(defenseKindFor("vulnerability")).toBe("vulnerabilities");
  });
});
