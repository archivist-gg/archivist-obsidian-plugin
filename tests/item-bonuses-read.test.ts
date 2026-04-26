// tests/item-bonuses-read.test.ts
import { describe, it, expect } from "vitest";
import { readNumericBonus } from "../src/modules/item/item.bonuses";
import type { ConditionContext } from "../src/modules/item/item.conditions.types";

const baseCtx: ConditionContext = {
  derived: { equippedSlots: {} },
  classList: [],
  race: null,
  subclasses: [],
};

describe("readNumericBonus", () => {
  it("returns null for undefined", () => {
    expect(readNumericBonus(undefined, baseCtx)).toBeNull();
  });

  it("returns null for zero (flat)", () => {
    expect(readNumericBonus(0, baseCtx)).toBeNull();
  });

  it("returns null for zero value in conditional bonus", () => {
    expect(readNumericBonus({ value: 0, when: [] }, baseCtx)).toBeNull();
  });

  it("returns applied for flat number", () => {
    expect(readNumericBonus(2, baseCtx)).toEqual({ kind: "applied", value: 2 });
  });

  it("returns applied for ConditionalBonus when all true", () => {
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] },
      baseCtx,
    );
    expect(r).toEqual({ kind: "applied", value: 2 });
  });

  it("returns applied for ConditionalBonus with empty when[]", () => {
    expect(readNumericBonus({ value: 3, when: [] }, baseCtx)).toEqual({
      kind: "applied",
      value: 3,
    });
  });

  it("returns skipped when any condition false", () => {
    const ctx: ConditionContext = {
      ...baseCtx,
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    };
    const r = readNumericBonus({ value: 2, when: [{ kind: "no_armor" }] }, ctx);
    expect(r).toEqual({ kind: "skipped" });
  });

  it("returns informational when any condition informational and none false", () => {
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "vs_attack_type", value: "ranged" }] },
      baseCtx,
    );
    expect(r).toEqual({
      kind: "informational",
      value: 2,
      conditions: [{ kind: "vs_attack_type", value: "ranged" }],
    });
  });

  it("false beats informational (engine certainty)", () => {
    const ctx: ConditionContext = {
      ...baseCtx,
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    };
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "no_armor" }, { kind: "underwater" }] },
      ctx,
    );
    expect(r).toEqual({ kind: "skipped" });
  });
});
