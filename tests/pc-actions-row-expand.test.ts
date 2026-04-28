/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { createExpandState } from "../src/modules/pc/components/actions/row-expand";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("row-expand helper", () => {
  it("createExpandState exposes is/toggle/keys for a Set<string>", () => {
    const s = createExpandState();
    expect(s.is("a")).toBe(false);
    s.toggle("a");
    expect(s.is("a")).toBe(true);
    s.toggle("a");
    expect(s.is("a")).toBe(false);
  });

  it("createExpandState seeds from initial values", () => {
    const s = createExpandState(["x", "y"]);
    expect(s.is("x")).toBe(true);
    expect(s.is("y")).toBe(true);
    expect(s.is("z")).toBe(false);
    expect(s.keys().sort()).toEqual(["x", "y"]);
  });
});
