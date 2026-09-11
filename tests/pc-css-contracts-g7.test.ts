import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R4-G7 CSS contracts · the live riders of the T7 rehearsal (S00).
 *
 * The same shape as `pc-css-contracts-g6b.test.ts`: the partial's own text is the contract, because a
 * grid track width has no jsdom-observable behaviour (jsdom does no layout, so a wrapped cell and a
 * one-line cell are indistinguishable to the suite). The number in each assertion is a LIVE
 * MEASUREMENT, recorded beside it.
 */
const PARTIALS = join(__dirname, "..", "packages", "obsidian", "src", "modules", "pc", "styles");
const read = (file: string): string => readFileSync(join(PARTIALS, file), "utf8");

/** The declaration block of the first rule whose selector list contains `selector`. */
function ruleOf(file: string, selector: string): string {
  const css = read(file);
  const ix = css.indexOf(selector);
  if (ix < 0) throw new Error(`no rule for ${selector} in ${file}`);
  const open = css.indexOf("{", ix);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("R4-G7 CSS contracts · RIDER-1 the Weapons table's Hit column", () => {
  // MEASURED LIVE at S00 (2026-09-11, the default 1024 x 800 window, `.pc-content` 620 px, the NEW
  // build fe9bb212): the Hit cell is a fixed 64 px track. `+6 to hit` needs 62 px on one line and
  // fits; `+11 to hit` needs 65 px and MISSES BY ONE PIXEL, so every character with a two-digit
  // attack bonus gets a two-line Hit cell ("+11 to" / "hit") and a taller weapon row. Witnessed on
  // `conv-path-of-the-zealot-5e-20` (both weapon rows, with the ADV chip) and on
  // `conv-warrior-of-mercy2024-20`'s Unarmed Strike row (no chip, cell height 32 px against a 15.6 px
  // line height), while `srd-fighter5e-11` at `+8 to hit` and `srd-fighter2024-5` at `+5 to hit` sit
  // on one line. 72 px is the Range column's own track, so the number now has 7 px of slack and the
  // two Hit-side tracks read as one rhythm.
  const TRACK = /grid-template-columns:\s*66px minmax\(0, 1fr\) 72px 72px/;

  it("the weapons row gives the Hit column 72px, not the 64px that wrapped a two-digit bonus", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-weapons-table .pc-action-row");
    expect(block).toMatch(TRACK);
    expect(block).not.toMatch(/66px minmax\(0, 1fr\) 72px 64px/);
  });

  it("the weapons HEADER uses the same track, so the column heads stay aligned over the rows", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-weapons-table .pc-weapon-header");
    expect(block).toMatch(TRACK);
  });

  it("the has-mastery six-column template carries the widened Hit track too", () => {
    const css = read("actions.css");
    const ix = css.indexOf(".archivist-pc-sheet .pc-weapons-table .pc-action-row.has-mastery");
    expect(ix).toBeGreaterThan(-1);
    const block = css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
    expect(block).toMatch(/grid-template-columns:\s*66px minmax\(0, 1fr\) 72px 72px/);
    expect(block).not.toMatch(/72px 64px/);
  });

  it("no weapons-table template is left on the 64px Hit track", () => {
    const css = read("actions.css");
    const hits = css.match(/66px minmax\(0, 1fr\) 72px 64px/g) ?? [];
    expect(hits).toHaveLength(0);
  });
});
