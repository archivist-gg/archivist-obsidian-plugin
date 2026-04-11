import { describe, it, expect } from "vitest";
import { decorateProseDice } from "../src/renderers/prose-decorator";

describe("decorateProseDice", () => {
  it("wraps a bare 1d6", () => {
    expect(decorateProseDice("deal 1d6 damage")).toBe("deal `dice:1d6` damage");
  });
});
