/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderACTooltip } from "../src/modules/pc/components/ac-tooltip";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { ACTerm } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

describe("renderACTooltip", () => {
  const terms: ACTerm[] = [
    { source: "Plate", amount: 18, kind: "armor" },
    { source: "DEX modifier", amount: 0, kind: "dex" },
    { source: "Shield", amount: 2, kind: "shield" },
    { source: "Cloak of Protection", amount: 1, kind: "item" },
  ];

  it("renders one row per term", () => {
    const root = document.createElement("div");
    renderACTooltip(root, { ac: 21, breakdown: terms, overridden: false });
    expect(root.querySelectorAll(".pc-ac-tooltip-row")).toHaveLength(4);
    expect(root.querySelector(".pc-ac-tooltip-total")?.textContent).toContain("21");
  });

  it("when overridden, marks underlying terms grey and floats Override at top", () => {
    const root = document.createElement("div");
    renderACTooltip(root, { ac: 19, breakdown: terms, overridden: true });
    expect(root.querySelector(".pc-ac-tooltip-override")).not.toBeNull();
    const greys = root.querySelectorAll(".pc-ac-tooltip-row.is-greyed");
    expect(greys.length).toBe(4);
  });
});
