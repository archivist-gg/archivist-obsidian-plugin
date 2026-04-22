import { describe, it, expect } from "vitest";
import { decorateProseDice } from "../src/shared/rendering/prose-decorator";

describe("decorateProseDice", () => {
  it("wraps a bare 1d6", () => {
    expect(decorateProseDice("deal 1d6 damage")).toBe("deal `dice:1d6` damage");
  });

  it("wraps dice with a modifier", () => {
    expect(decorateProseDice("deal 2d6+3 damage")).toBe("deal `dice:2d6+3` damage");
  });

  it("normalizes whitespace around the sign", () => {
    expect(decorateProseDice("HP: 37d8 + 259")).toBe("HP: `dice:37d8+259`");
  });

  it("handles negative modifiers", () => {
    expect(decorateProseDice("penalty 1d6-1")).toBe("penalty `dice:1d6-1`");
  });

  it("skips dice already inside a backtick tag", () => {
    const input = "already `damage:1d6+3` tagged";
    expect(decorateProseDice(input)).toBe(input);
  });

  it("skips dice-shaped substrings inside identifiers", () => {
    expect(decorateProseDice("abc1d6xyz")).toBe("abc1d6xyz");
  });

  it("wraps multiple independent dice in one string", () => {
    expect(decorateProseDice("1d4 fire plus 2d6 cold")).toBe(
      "`dice:1d4` fire plus `dice:2d6` cold",
    );
  });

  it("leaves non-dice text unchanged", () => {
    expect(decorateProseDice("no dice here at all")).toBe("no dice here at all");
  });

  it("does not wrap a bare size-less 3d", () => {
    expect(decorateProseDice("roll 3d and hope")).toBe("roll 3d and hope");
  });
});
