/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderSituationalRows } from "../src/modules/pc/components/situational-rows";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderSituationalRows", () => {
  it("renders one row per informational entry with condition text", () => {
    const parent = document.createElement("div");
    renderSituationalRows(parent, [
      { field: "saving_throws", source: "Cloak", value: 1, conditions: [{ kind: "vs_spell_save" }] },
    ]);
    const rows = parent.querySelectorAll(".pc-situational-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Cloak");
    expect(rows[0].textContent).toContain("+1");
    expect(rows[0].textContent).toContain("vs spells");
  });

  it("renders nothing for empty input", () => {
    const parent = document.createElement("div");
    renderSituationalRows(parent, []);
    expect(parent.childElementCount).toBe(0);
  });
});
