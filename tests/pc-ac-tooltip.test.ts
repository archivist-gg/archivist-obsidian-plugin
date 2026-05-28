/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("AC tooltip CSS (parchment styling)", () => {
  // The tooltip must follow the PC sheet's parchment aesthetic (light bg,
  // dark text). Plain Obsidian theme variables (--background-primary, etc.)
  // resolve to dark in dark mode, producing a near-invisible dark-on-dark
  // tooltip. Assert the CSS rule pulls from --pc-* tokens instead.
  const cssPath = resolve(__dirname, "../src/modules/pc/styles/components.css");
  const css = readFileSync(cssPath, "utf8");
  // Extract the .pc-ac-tooltip block (top-level rule, NOT the -row/-total
  // descendants). Match `.pc-ac-tooltip {` followed by everything up to the
  // first matching closing brace.
  const blockMatch = css.match(/\.pc-ac-tooltip\s*\{([^}]+)\}/);

  it("rule exists in components.css", () => {
    expect(blockMatch).not.toBeNull();
  });

  it("background is parchment, not Obsidian-theme default", () => {
    const block = blockMatch?.[1] ?? "";
    expect(block).toMatch(/background:\s*var\(--pc-parchment-light/);
    expect(block).not.toMatch(/background:\s*var\(--background-primary/);
  });

  it("text color is the parchment-page primary text", () => {
    const block = blockMatch?.[1] ?? "";
    expect(block).toMatch(/color:\s*var\(--pc-text-primary/);
  });

  it("border uses the parchment tan token", () => {
    const block = blockMatch?.[1] ?? "";
    expect(block).toMatch(/border:[^;]*var\(--pc-tan/);
  });
});
