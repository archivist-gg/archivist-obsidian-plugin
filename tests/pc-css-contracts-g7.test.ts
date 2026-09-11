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

describe("R4-G7 CSS contracts · RIDER-2 a list inside a monster trait", () => {
  const DND = join(__dirname, "..", "packages", "obsidian", "src", "styles");
  const dnd = (): string => readFileSync(join(DND, "archivist-dnd.css"), "utf8");

  // MEASURED LIVE at S00 on `Compendium/Baldur's Gate_ Descent Into Avernus/Monsters/Burney the Barber.md`
  // (the `- ` list inside `Bahamut's Blessings`, 4 items, and a second 2-item list inside `Acid Breath`):
  // `.archivist-feature` sets `text-indent: -1em` for the stat block's hanging indent, and an `li` inside
  // a feature entry INHERITS it, so the item's FIRST line is pulled 1em (13 px at the block's 13 px type)
  // to the left, straight into the gutter the `list-style-position: outside` marker occupies. Measured:
  // the li box starts at x 507 (its own 22.308 px left margin off the ul at 484.6) while the first text
  // node starts at 493, a 14 px outdent, and the disc marker overprints the first character ("Unless",
  // "Burney", "Once" each wear their bullet). The name's hang is deliberate; an item's is not.
  it("a list item inside a feature entry does not inherit the stat block's hanging indent", () => {
    const css = dnd();
    const ix = css.indexOf(".archivist-feature-entry li");
    expect(ix).toBeGreaterThan(-1);
    const block = css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
    expect(block).toMatch(/text-indent:\s*0/);
  });

  it("the hanging indent that causes it is still declared on the feature itself", () => {
    const css = dnd();
    const ix = css.indexOf(".archivist-feature {");
    expect(ix).toBeGreaterThan(-1);
    const block = css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
    expect(block).toMatch(/text-indent:\s*-1em/);
  });
});

describe("R4-G7 CSS contracts · RIDER-3 a long decision value on the builder's strip", () => {
  // WITNESSED LIVE at S00 on `conv-fighter2024-5-B`'s Class step: the Weapon Mastery row's resolved
  // summary read `✓ Antimatter Rifle, Antimatter Rifle, Automatic Pistol, Automa` and was CUT at the
  // card's right edge, mid-word, with no ellipsis. The mechanism is in the rule itself:
  // `.pc-dstrip-val` is `white-space: nowrap` with `margin-left: auto` inside the `.pc-dstrip-head`
  // flex row and carries NO `min-width: 0`, so a flex child cannot shrink below its content width and
  // the surplus runs past the row and is clipped by the card. A choose-4 row with real weapon names is
  // long enough to reach it, so this is not an artefact of the driver's first picks.
  it("the decision value can shrink inside its flex row and ellipsises instead of being cut", () => {
    const block = ruleOf("chronicle.css", ".pc-dstrip-val");
    expect(block).toMatch(/white-space:\s*nowrap/);
    expect(block).toMatch(/min-width:\s*0/);
    expect(block).toMatch(/overflow:\s*hidden/);
    expect(block).toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe("R4-G7 CSS contracts · RIDER-5 two controls sharing the feature row's detail slot", () => {
  // WITNESSED LIVE at S00 on `conv-warrior-of-mercy2024-20`'s Passive & Features tab, page 4, the
  // `Hand of Ultimate Mercy` row: the recovery track's `/ Long Rest` label and the
  // `Spend 5 Focus Point` pill sit side by side and the pill's left border ABUTS the word `Rest`
  // with zero air, so the two controls read as one run. The mechanism is in the rule itself:
  // `.pc-feature-detail` is a wrapping flex row that declares `row-gap` and NO column gap, which is
  // why R4-G5 had to patch ONE child (`> .pc-resource-die { margin-right }`) and why its own comment
  // calls this "this gapless slot". A row reaches the pairing whenever a feature OWNS a resource
  // (so the tracker takes the slot) while SPENDING a foreign one (so `controlInSlot` is true,
  // `feature-rows.ts:157`); the Monk's Hand of Ultimate Mercy owns 1 / Long Rest and spends 5 Focus
  // Points. `boon-rows.ts:97` reaches it too, with `.pc-boon-status` + tracker + `.pc-spend`.
  // The fix is the container gap, NOT another per-child margin: the slot is `flex-wrap: wrap`, and a
  // margin would still indent the control when it WRAPS onto its own line, which the R4-G5 comment
  // above the rule records as the wanted reading ("each line starting at the slot's left edge").
  // `column-gap` applies only between items that share a line. `--pc-space-2` is 8px, the exact value
  // the retired `.pc-resource-die` margin carried, so the granted-die row's spacing is unchanged.
  it("the detail slot separates two controls that share a line", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-feature-detail");
    expect(block).toMatch(/column-gap:\s*var\(--pc-space-2\)/);
    // the wrapped-line gap this rule already had is untouched
    expect(block).toMatch(/row-gap:\s*var\(--pc-space-1\)/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
  });

  it("the per-child margin the gapless slot needed is retired, so the die is not spaced twice", () => {
    const css = read("actions.css");
    expect(css).not.toMatch(/\.pc-feature-detail > \.pc-resource-die\s*\{[^}]*margin-right/);
  });
});
