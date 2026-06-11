import { describe, it, expect } from "vitest";
import {
  ABILITY_METHODS, STANDARD_ARRAY, POINT_BUY_RULES,
  pointBuySpent, pointBuyRemaining, allowedScores,
} from "../src/modules/pc/components/builder/ability-methods";

const ALL10 = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

describe("ABILITY_METHODS registry", () => {
  it("lists the five concrete methods in display order", () => {
    expect(ABILITY_METHODS.map((m) => m.id)).toEqual([
      "standard-array", "point-buy", "archivist-point-buy", "manual", "rolled",
    ]);
    expect(ABILITY_METHODS.find((m) => m.id === "archivist-point-buy")?.homebrew).toBe(true);
  });
});

describe("standard point buy (27 / 8-15)", () => {
  const rule = POINT_BUY_RULES["point-buy"]!;
  it("classic costs", () => {
    expect(pointBuySpent(rule, { ...ALL10, str: 15, dex: 14 })).toBe(9 + 7 + 2 + 2 + 2 + 2);
    expect(pointBuyRemaining(rule, { ...ALL10 })).toBe(27 - 12);
  });
  it("allowedScores excludes values the budget cannot afford", () => {
    const tight = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }; // spent 27
    expect(allowedScores(rule, tight, "int")).toEqual([8]); // no headroom
    expect(allowedScores(rule, { ...ALL10 }, "str")).toContain(15);
    expect(allowedScores(rule, { ...ALL10 }, "str")).not.toContain(16); // out of range
  });
});

describe("archivist point buy (28 / 7-16, 7 refunds a point)", () => {
  const rule = POINT_BUY_RULES["archivist-point-buy"]!;
  it("cost table per the spec (cost = −delta)", () => {
    expect(rule.cost[7]).toBe(-1);
    expect(rule.cost[8]).toBe(0);
    expect(rule.cost[10]).toBe(2);
    expect(rule.cost[16]).toBe(11);
  });
  it("a 16/15 spread spends 28 exactly", () => {
    const spread = { str: 16, dex: 15, con: 10, int: 10, wis: 10, cha: 10 };
    expect(pointBuySpent(rule, spread)).toBe(11 + 9 + 2 + 2 + 2 + 2);
    expect(pointBuyRemaining(rule, spread)).toBe(0);
  });
  it("dump stats refund points", () => {
    const dump = { str: 7, dex: 7, con: 8, int: 8, wis: 8, cha: 8 };
    expect(pointBuySpent(rule, dump)).toBe(-2);
    expect(pointBuyRemaining(rule, dump)).toBe(30);
  });
  it("allowedScores drops a 16 once the budget is nearly exhausted (refund-table path)", () => {
    // Everything but con spends 9+7+1+1+1 = 19, leaving 9 of headroom for con:
    // a 15 (cost 9) still fits but a 16 (cost 11) does not, so 16 drops out.
    const tight = { str: 15, dex: 14, con: 16, int: 9, wis: 9, cha: 9 };
    const con = allowedScores(rule, tight, "con");
    expect(con).toContain(15);
    expect(con).not.toContain(16);
  });
});

describe("STANDARD_ARRAY", () => {
  it("is the PHB array", () => expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]));
});

describe("out-of-range scores (manual leftovers when switching methods)", () => {
  const rule = POINT_BUY_RULES["point-buy"]!;
  it("clamp into range for spend math instead of throwing", () => {
    expect(() => pointBuySpent(rule, { ...ALL10, str: 20 })).not.toThrow();
    expect(pointBuySpent(rule, { ...ALL10, str: 20 })).toBe(pointBuySpent(rule, { ...ALL10, str: 15 }));
  });
});
