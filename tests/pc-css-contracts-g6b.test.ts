/**
 * R4-G6b · the phase's CSS-source contracts (spec §13.3, §14 row 27).
 *
 * Every rule this phase ADDS to a CSS partial gets one row here. The helper reads the PARTIAL under
 * `packages/obsidian/src/modules/pc/styles/`, never the generated root `styles.css`: `check:css` compares
 * `styles.css` against a fresh build, so it catches a STALE artifact, not a deleted rule (deleting a rule from
 * the partial and re-running `build:css` leaves `check:css` green). THIS file is what goes red.
 *
 * The rows are added task by task: T6 owns the `.pc-hp-over` pair in `components.css` and CARRIES the four
 * `.pc-unarmed-card*` rules T2's fix round added to `actions.css`; T8 (the caption primitive), T9 (the sticky
 * rail) and T10 (the body-fit blocks) APPEND their own rows to this file.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STYLES_DIR = resolve(__dirname, "../packages/obsidian/src/modules/pc/styles");

/**
 * The declaration block of an EXACT selector in one partial. `cssPath` is the partial's name under
 * `STYLES_DIR` (this file reads several partials, so the path is an argument rather than a closed-over
 * constant as in `pc-defenses-conditions-panel.test.ts`). The `\s*\{` tail anchors the match to the whole
 * selector, so `.pc-unarmed-card` never matches `.pc-unarmed-card-head`.
 */
const ruleOf = (cssPath: string, selector: string): string => {
  const css = readFileSync(resolve(STYLES_DIR, cssPath), "utf8");
  const match = css.match(new RegExp(selector.replace(/[.\\[\]()]/g, "\\$&") + "\\s*\\{([^}]+)\\}"));
  expect(match, `${selector} rule missing from ${cssPath}`).toBeTruthy();
  return (match as RegExpMatchArray)[1];
};

describe("R4-G6b CSS contracts · §6 the over-max HP flag (components.css)", () => {
  it("the flagged CURRENT value is crimson", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-hp-current.pc-hp-over .pc-hp-val");
    expect(block).toMatch(/color:\s*var\(--pc-crimson\)/);
  });

  it("the mark carries its own small crimson superscript dress, not the override pill", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-hp-over-mark");
    expect(block).toMatch(/vertical-align:\s*super/);
    expect(block).toMatch(/font-size:\s*0\.7em/);
    expect(block).toMatch(/color:\s*var\(--pc-crimson\)/);
    expect(block).toMatch(/cursor:\s*help/);
    // NOT the `.archivist-override-mark` pill (a click target): no absolute positioning of its own.
    expect(block).not.toMatch(/position:\s*absolute/);
  });
});

describe("R4-G6b CSS contracts · §5.5 the Unarmed Strike expand card (actions.css, carried from T2)", () => {
  it("the card is a flex column with a bounded width", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-unarmed-card");
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/flex-direction:\s*column/);
    expect(block).toMatch(/max-width:\s*22em/);
  });

  it("the term head is emphasised and spaced", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-unarmed-card-head");
    expect(block).toMatch(/font-weight:\s*600/);
    expect(block).toMatch(/margin:/);
  });

  it("a row puts the source left and the amount right", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-unarmed-card-row");
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/justify-content:\s*space-between/);
  });

  it("the amount is tabular so the signed numbers line up", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-unarmed-card-amount");
    expect(block).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
