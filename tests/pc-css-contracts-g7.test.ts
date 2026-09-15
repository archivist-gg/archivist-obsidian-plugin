import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { containerBlockIn } from "./fixtures/pc/css-contract-helpers";

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

describe("R4-G7 CSS contracts · RIDER-3 RE-TAKEN at the cause (T7 fix round 1)", () => {
  const CHRON = "chronicle.css";
  // THE FIRST RIDER-3 DID NOT FIX THE DEFECT. Measured by the reviewer on the captured frames
  // (2048 x 1600): the `.pc-dstrip-val` glyphs reach x 1941 before the rider and x 1940 after it, while
  // the `.pc-dstrip-row` border sits at x 1905 in every one, so the value still escapes its row by about
  // 35 px and is still cut by the card with NO ellipsis. The rider's CSS WAS live (the value's start
  // moved right), so it was an ineffective fix, not an undeployed one.
  //
  // THE CAUSE IS ONE LEVEL UP. `.pc-dstrip-head` is `flex-basis: 100%; display: flex` and is itself a
  // flex ITEM of the wrapping `.pc-dstrip-row`. A flex item's default `min-width: auto` refuses to shrink
  // below its content, and the head's content includes the `white-space: nowrap` value, so the HEAD is
  // what overflows: the val is never the box that runs out of room, and `text-overflow: ellipsis` on the
  // val can therefore never fire. `min-width: 0` on the head lets it shrink to the row, which makes the
  // val the flexible child, which is what the val's own (already shipped) `min-width: 0; overflow: hidden;
  // text-overflow: ellipsis` needs to do its job.
  //
  // THIS TEST IS NOT THE WITNESS. jsdom computes no layout, so no CSS-text contract can fail on a layout
  // bug: that is exactly how the first rider passed its contract while the defect stood. The witness is
  // the LIVE geometry read now recorded per decision row by `builder-drive.mjs`
  // (`geom.valWithinRow`, rolled up as `geomWitness.verdict`), teed on the pre-fix build and the post-fix
  // build. This contract only pins the rule so it cannot be silently removed again.
  // The selector is addressed with its FULL `:is(...)` prefix, which appears only in the rule itself.
  // `ruleOf` takes the FIRST occurrence of the string, and the bare class name `.pc-dstrip-head` occurs
  // first inside the comment above `.pc-dstrip-val`, so the bare name resolved to the WRONG block and the
  // test failed for the wrong reason on its first run. Measured, not assumed: that first run failed on
  // `flex-basis: 100%` (a val property it never had) instead of on the missing `min-width: 0`.
  const HEAD = ":is(.archivist-pc-sheet, .archivist-modal) .pc-dstrip-head";
  const VAL = ":is(.archivist-pc-sheet, .archivist-modal) .pc-dstrip-val";

  it("the decision head can shrink, so the value inside it is the box that ellipsises", () => {
    const block = ruleOf(CHRON, HEAD);
    expect(block).toMatch(/min-width:\s*0/);
    expect(block).toMatch(/flex-basis:\s*100%/);
    expect(block).toMatch(/display:\s*flex/);
  });

  it("the value keeps the shrink and ellipsis rules the first rider gave it", () => {
    const block = ruleOf(CHRON, VAL);
    expect(block).toMatch(/min-width:\s*0/);
    expect(block).toMatch(/overflow:\s*hidden/);
    expect(block).toMatch(/text-overflow:\s*ellipsis/);
  });

  // RIDER-6 (T7 fix round 1, found by this round's OWN eye pass on its own race frames, then measured).
  // `.pc-cb-badge` is the chronicle card's corner source line. It was `position: absolute; top: 11px;
  // right: 13px` inside the relatively positioned `.pc-cblock`, so it had NO width in flow and the
  // card title (`.pc-cb-name`, an h3) ran the full card width underneath it. MEASURED live by the
  // driver's new card-head witness on the pre-fix build: on the race preview card the badge box
  // `l 753 · r 919 · t 1826 · b 1840` INTERSECTS the title box of `Goliath; Frost Giant Ancestry`, and
  // on the background card the same happens with `Forgotten Realms: Heroes of Faerun · 2024` over
  // `Ice Fisher`; the captured frame shows the grey source text printed through the title's glyphs.
  // This is the same defect class R4-G6b's rider R-4 fixed for `.archivist-pc-sheet .pc-resource-card
  // .source-badge`; that rider was scoped to the sheet's feature card, and the builder's chronicle card
  // is a second surface of it. The card's own source already comments that the absolute badge collides
  // with the band-right controls in owned-card mode, where it is moved INLINE; the race / background /
  // browse cards (no `bandRight`) kept the corner badge and are the ones that collide with the TITLE.
  //
  // The fix is the same as R-4's: a RIGHT FLOAT takes part in flow, so the title's line boxes shorten by
  // exactly the badge's own width, whatever that text is and in whatever face the theme renders it. The
  // margins reproduce the old position rather than inventing a new one: `-4px` top because an absolute
  // `top: 11px` is measured from the padding box while a float starts after the card's 15px padding-top,
  // and `-5px` right because an absolute `right: 13px` is measured from the padding box while a float
  // starts at the content edge, 18px of padding plus the 1px border in.
  //
  // THIS TEST IS NOT THE WITNESS, for the same reason as RIDER-3b above: jsdom computes no layout. The
  // witness is the live card-head read in `builder-drive.mjs` (`cardHeadWitness.verdict`), FAIL on the
  // pre-fix build and PASS after. This contract only pins the rule.
  const BADGE = ":is(.archivist-pc-sheet, .archivist-modal) .pc-cb-badge";

  it("the chronicle card's source badge takes part in flow, so it never paints over the title", () => {
    const block = ruleOf(CHRON, BADGE);
    expect(block).toMatch(/float:\s*right/);
    expect(block).toMatch(/position:\s*static/);
    expect(block).not.toMatch(/position:\s*absolute/);
  });
});

describe("R4-G7 CSS contracts · RIDER-7 the per-tab body collapse is retired, the width tier stays (CLEANLINESS PIN)", () => {
  // THIS TEST IS NOT THE WITNESS. The kill-power row is the jsdom render in `tests/pc-sheet.test.ts`
  // (a short tab beside a tall rail never gets `pc-body-fit-one`), and the live witness is the W-A
  // session's per-tab read of `.pc-body`'s class and the content / rail rects. This block only pins that
  // no selector for the retired dress survives in a partial or in the generated `styles.css`, and that the
  // ONE rule that still stacks the body reads the pane's width.
  const ROOT_CSS = join(__dirname, "..", "styles.css");

  it("no partial and not the generated styles.css carries a body-fit selector", () => {
    const partials = ["layout.css", "components.css", "containers.css", "actions.css", "inventory.css"];
    const hits = partials.filter((f) => /pc-body-(?:fit-one|measure)/.test(read(f)));
    expect(hits).toEqual([]);
    expect(readFileSync(ROOT_CSS, "utf8")).not.toMatch(/pc-body-(?:fit-one|measure)/);
  });

  it("the body stacks only under the pc-sheet 499 px width tier", () => {
    const css = read("layout.css");
    const head = "@container pc-sheet (max-width: 499px) {";
    expect(css.indexOf(head)).toBeGreaterThan(-1);
    const tier = containerBlockIn(css, "pc-sheet (max-width: 499px)") as string;
    expect(tier).toMatch(/\.archivist-pc-sheet \.pc-body \{\s*grid-template-columns: 1fr;/);
    // exactly one one-column body template in the partial, and it is the one inside that tier
    expect(css.match(/grid-template-columns:\s*1fr;/g) ?? []).toHaveLength(1);
    expect(css).not.toContain("@container pc-sheet (min-width: 500px)");
  });

  it("fix round 1: layout.css no longer claims the sheet has no horizontal padding (measured 24 px a side)", () => {
    // matched across the comment's line breaks and its ` * ` gutters (the clause is wrapped over two lines)
    expect(read("layout.css")).not.toMatch(/has\s+no\s+(?:\*\s*)?horizontal\s+(?:\*\s*)?padding/);
  });
});

describe("R4-G7 CSS contracts · RIDER-8 a strip with a pool tab reaches the short labels earlier (CLEANLINESS PIN)", () => {
  // THIS TEST IS NOT THE WITNESS: jsdom lays nothing out. The witness is the W-A live read (strip rows per tab on the
  // deployed pair) and the off-screen strip lab (`evidence/g7-live/wa-strip-lab.js`), which measured the thresholds
  // pinned here: the widest five / six / seven tab strip first holds one line at 489 / 618 / 678 px with full labels.
  const tier = (css: string, px: number): string => {
    const block = containerBlockIn(css, `pc-content (max-width: ${px}px)`);
    expect(block, `@container pc-content (max-width: ${px}px)`).not.toBeNull();
    return block as string;
  };

  it("each strip length switches to the declared short labels one pixel below its own measurement", () => {
    const css = read("components.css");
    // Fix round 1: the seven-tab threshold moved 677 -> 768. The rows-only scan missed that at 700..768 px the base dress
    // runs 769 px of buttons in the bar under a hidden scrollbar; gated on scrollWidth <= clientWidth the widest seven-tab
    // strip first FITS with full labels at 769 px.
    for (const [px, n] of [[488, 5], [617, 6], [768, 7]] as const) {
      const block = tier(css, px);
      const sel = `.archivist-pc-sheet .pc-tabs-bar:has(> .pc-tab-btn:nth-child(${n})) .pc-tab-btn`;
      expect(block).toContain(`${sel} { padding: 5px 4px; font-size: 0; letter-spacing: 0; }`);
      expect(block).toContain(`${sel}::before { content: attr(data-short); font-size: 10px; letter-spacing: 0; }`);
    }
  });

  it("the 299 px short-label block still reads every strip, whatever its length", () => {
    const block = tier(read("components.css"), 299);
    expect(block).toMatch(/\.archivist-pc-sheet \.pc-tab-btn::before \{\s*content: attr\(data-short\);\s*font-size: 10px;\s*letter-spacing: 0\.2px;/);
  });
});

describe("R4-G7 CSS contracts · RIDER-8 fix round 1 a wrapping strip is an EVEN GRID, never an orphan (CLEANLINESS PIN)", () => {
  // Controller ruling 2026-09-15: the strip never leaves a tab alone on a line. Below the content width at which a strip
  // of n tabs FITS one line (measured by the gated strip lab: four 229, five 347, six 455, seven 505 px), it lays out as
  // ceil(n / 2) equal columns (4 tabs 2 x 2, 5 tabs 3 + 2, 6 tabs 3 x 2, 7 tabs 4 + 3), a label wraps inside its cell.
  // NOT THE WITNESS: the lab's orphan scan and the W-A2 live read are.
  const grid = (px: number): string => {
    const block = containerBlockIn(read("components.css"), `pc-content (max-width: ${px}px)`);
    expect(block, `@container pc-content (max-width: ${px}px)`).not.toBeNull();
    return block as string;
  };

  it("each strip length becomes an even grid one pixel below the width at which it first fits", () => {
    for (const [px, has, columns] of [[228, "nth-child(4):last-child", 2], [346, "nth-child(5):last-child", 3], [454, "nth-child(6):last-child", 3], [504, "nth-child(7)", 4]] as const) {
      const bar = `.archivist-pc-sheet .pc-tabs-bar:has(> .pc-tab-btn:${has})`;
      expect(grid(px)).toContain(`${bar} { display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); }`);
      expect(grid(px)).toContain(`${bar} > .pc-tab-btn { min-width: 0; height: auto; white-space: normal; text-align: center; justify-content: center; overflow-wrap: anywhere; }`);
    }
  });
});

describe("R4-G7 CSS contracts · RIDER-9 an inventory row stays one row in the right column (CLEANLINESS PIN)", () => {
  // THIS TEST IS NOT THE WITNESS: the W-A live read (meta cells below the name cell, per row) and the off-screen
  // inventory lab (`evidence/g7-live/wa-inv-lab.js`) are. The floors are the corpus's widest rendered values.
  const block = (px: number): string => {
    const found = containerBlockIn(read("inventory.css"), `pc-content (max-width: ${px}px)`);
    expect(found, `@container pc-content (max-width: ${px}px)`).not.toBeNull();
    return found as string;
  };

  it("below 500 px the row keeps all six tracks on one line, the meta tracks floored at their measured widths", () => {
    const b = block(499);
    expect(b).toMatch(/grid-template-columns: 18px 18px minmax\(0, 1fr\) minmax\(67px, auto\) minmax\(53px, auto\) minmax\(35px, auto\);/);
    expect(b).toMatch(/grid-template-areas: "toggle icon name stat weight qty";/);
    expect(b).not.toContain('".      .    weight qty"');
  });

  it("fix round 1: below 500 px the item name WRAPS inside its track instead of ellipsising", () => {
    const b = block(499);
    expect(b).toContain(".archivist-pc-sheet .pc-inv-name { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }");
  });

  it("fix round 1: the wide template's weight track is floored at the widest corpus weight too (0.0625 lb, 52.2 px)", () => {
    const base = ruleOf("inventory.css", ".archivist-pc-sheet .pc-inv-row {");
    expect(base).toMatch(/grid-template-columns: 18px 18px minmax\(0, 1fr\) 96px minmax\(53px, auto\) 56px;/);
  });

  it("the two-row reflow starts at 287 px and the four-line stack at 191 px, never at 399", () => {
    expect(block(287)).toContain('".      .    weight qty"');
    expect(block(191)).toContain('".      .    qty"');
    expect(block(399)).not.toContain("grid-template-areas");
  });
});

describe("R4-G7 CSS contracts · RIDER-18 a multiclass spellcasting summary is one unit per class (CLEANLINESS PIN, NOT live measured: S03)", () => {
  // The separated caption's default unit is `white-space: nowrap`, and a nowrap unit wider than its clipping host is
  // CUT (live rider F-B, `actions.css`). A summary unit is an inline-block instead: it moves to the next line WHOLE
  // when it does not fit at a line end, and wraps inside itself only when it is wider than the whole row. jsdom does
  // no layout, so the partial's text is the contract; the numbers of the gap are derived from G6b's live separator
  // widths, and the line geometry is S03's witness.
  it("the summary unit is an inline-block capped at the row width that may wrap inside itself", () => {
    const block = ruleOf("spells.css", ".archivist-pc-sheet .pc-spell-dc-list .pc-cap-unit");
    expect(block).toMatch(/display:\s*inline-block/);
    expect(block).toMatch(/max-width:\s*100%/);
    expect(block).toMatch(/white-space:\s*normal/);
  });
  it("the summary host widens the inter-unit gap to 1em for the wider `/ ` separator box", () => {
    expect(ruleOf("spells.css", ".archivist-pc-sheet .pc-spell-dc-list {")).toMatch(/--pc-cap-gap:\s*1em/);
  });
});

describe("R4-G7 CSS contracts · RIDER-20 a conditional roll tag is dashed (CLEANLINESS PIN; the tag TEXT carries the mark)", () => {
  it("the conditional class draws a dashed border and keeps the mode's colour", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-cond-tag-conditional {");
    expect(block).toMatch(/border-style:\s*dashed/);
    expect(block).not.toMatch(/color:/);
  });
});

describe("R4-G7 CSS contracts · RIDER-25 the crit caption is a block line with air above it (MEASURED LIVE in W-Dr's lab)", () => {
  // W-Dr (2026-09-15, the default 1024 x 800 window, `conv-champion-5e-20` Unarmed Strike): the inline caption sat on the damage
  // text's line with a 0 px gap; `display: block` alone left the caption's box 0.4 px INTO the damage tag's; `margin-top: 2px`
  // measured a 1.6 px gap. The element is a DIV already (weapons-table.ts); the rule states the block for a theme that restyles divs.
  it("the crit caption is display: block with margin-top: 2px", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-weapon-crit {");
    expect(block).toMatch(/display:\s*block/);
    expect(block).toMatch(/margin-top:\s*2px/);
  });
});

describe("R4-G7 CSS contracts · RIDER-26 an item row stacks while its name track is under the one-line floor (MEASURED LIVE in W-Dr and W-D2a)", () => {
  // W-Dr (2026-09-15, the default 1024 x 800 window, `.pc-content` 355.5 px, the user's Illrigger, REACTIONS > ITEMS): the base
  // template `66px minmax(0, 1fr) 72px minmax(0, 3fr)` resolved to `66px 46.375px 72px 139.125px` and broke "Ring of Evasion" one
  // word per line (3 lines, row 75 px). The stacked candidate injected live resolved to `66px 273.5px`: the name on ONE line, the
  // range under the badge and the tracker under the name, row 85.9 px, 0 overlapping cells.
  // Fix round 1 (review Minor 4, ruled): the tier is DERIVED from measured widths, not "below 500 px". W-D2a measured "Ring of
  // Evasion" on one line at 99.4 px (700 12px Libre Baskerville) and the row's 4 px side paddings and 8 px gaps, so the base name
  // track is (C - 66 - 72 - 8 - 3 * 8) / 4 = (C - 170) / 4: 82.5 at C = 500 and 97.5 at 560 (2 lines each, the rule shipped by
  // RIDER-26 left both), 100 at 570 (1 line). The floor rounds UP to 100 px so a fractional column just above the tier still holds
  // the name; the row stacks while (C - 170) / 4 < 100, i.e. up to C = 569. The candidate injected over C = 300..1000 set the name on
  // one line at every width.
  const ONE_LINE = 99.4;
  const FLOOR = Math.ceil(ONE_LINE);
  const TIER = 66 + 72 + 8 + 3 * 8 + 4 * FLOOR - 1;
  const actions = (): string => readFileSync(join(PARTIALS, "actions.css"), "utf8");
  const block = (): string => {
    const b = containerBlockIn(actions(), `pc-content (max-width: ${TIER}px)`);
    if (!b) throw new Error(`no pc-content (max-width: ${TIER}px) block in actions.css`);
    return b;
  };
  it("the derived tier is 569 px and holds the two-track items row", () => {
    expect(block()).toContain(".archivist-pc-sheet .pc-items-table .pc-action-row { grid-template-columns: 66px minmax(0, 1fr); row-gap: var(--pc-space-1); }");
    expect(TIER).toBe(569);
  });
  it("every cell is placed by name: badge and name on line 1, range under the badge, tracker under the name", () => {
    const b = block();
    expect(b).toContain(".archivist-pc-sheet .pc-items-table .pc-item-cost { grid-column: 1; grid-row: 1; }");
    expect(b).toContain(".archivist-pc-sheet .pc-items-table .pc-action-namecell { grid-column: 2; grid-row: 1; }");
    expect(b).toContain(".archivist-pc-sheet .pc-items-table .pc-action-range { grid-column: 1; grid-row: 2; }");
    expect(b).toContain(".archivist-pc-sheet .pc-items-table .pc-action-charges { grid-column: 2; grid-row: 2; }");
  });
  it("the items row is stacked by that tier alone: the 499 px block no longer carries an items-table rule", () => {
    expect(containerBlockIn(actions(), "pc-content (max-width: 499px)") ?? "").not.toContain(".pc-items-table");
  });
});

describe("R4-G7 CSS contracts · RIDER-27 the identity block wraps its text beside the avatar (MEASURED LIVE in W-Dr's lab)", () => {
  // W-Dr (2026-09-15, the default 1024 x 800 window): with `flex: 1 1 auto` the identity's flex base size was its one-line
  // max-content width, so `conv-battle-smith-2024-efa-20`'s 512 px subtitle, wider than the 507.5 px beside the 96 px avatar, moved
  // the WHOLE block to its own line under the avatar (`identityBeside=false`). `flex: 1 1 0` alone fixed that and, at emulated sheet
  // widths of 760 and 900 px, let the hero cluster share the first line and squeezed the identity to 14 / 154 px (the name on 5 to 7
  // lines). The 320 px floor keeps the hero off the first line unless the identity keeps at least 320 px: the default window reads
  // beside, subtitle on two lines; 760 and 900 read exactly as before on all three measured notes.
  it("the identity grows from a zero basis with a min(100%, 320px) floor", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-identity {");
    expect(block).toMatch(/flex:\s*1 1 0;/);
    expect(block).toMatch(/min-width:\s*min\(100%, 320px\);/);
  });
});

describe("R4-G7 fix round 1 · RIDER-27 below a 700 px sheet the identity keeps no floor (review Important 1; MEASURED in a headless replica)", () => {
  // The 320 px floor above has a job only where the hero cluster can share the first line. Inside
  // `@container pc-sheet (max-width: 699px)` the hero cluster is `width: 100%`, so it never does, and a floor wider than the room
  // beside the avatar (sheet - 100 px in the 499 tier) moved the WHOLE identity under the avatar on every sheet narrower than about
  // 420 px, short names included. The tier zeroes the floor. It wins by SOURCE ORDER only (the same specificity as the base rule),
  // so it must sit in that later block. Two blocks in components.css share the query (the stats band's, then the hero cluster's) and
  // `containerBlockIn` returns the first, so the pin walks every block with the query and reads the hero cluster's.
  const tiers = (css: string, query: string): { at: number; text: string }[] => {
    const out: { at: number; text: string }[] = [];
    for (let from = 0; ; ) {
      const text = containerBlockIn(css.slice(from), query);
      if (text === null) return out;
      const at = css.indexOf(text, from);
      out.push({ at, text });
      from = at + text.length;
    }
  };

  it("the pc-sheet 699 tier that wraps the hero cluster sets the identity's min-width to 0, after the base rule", () => {
    const css = read("components.css");
    const heroTier = tiers(css, "pc-sheet (max-width: 699px)").find((b) => b.text.includes(".archivist-pc-sheet .pc-hero-right {"));
    expect(heroTier?.text ?? "").toContain(".archivist-pc-sheet .pc-identity { min-width: 0; }");
    expect((heroTier as { at: number }).at).toBeGreaterThan(css.indexOf(".archivist-pc-sheet .pc-identity {"));
  });

  it("the base rule's comment no longer claims the narrow tier drops the block below the avatar 'as it always did'", () => {
    expect(read("components.css")).not.toMatch(/takes its own line, as it always did there/);
  });
});

describe("R4-G7 fix round 1 · RIDER-27 at 700 px and up the floor is the identity's own width when that is under 320 px (review Minor 1; MEASURED in a headless replica)", () => {
  // THIS TEST IS NOT THE WITNESS: jsdom lays nothing out. The witness is `evidence/g7-t8-wD1/lab/replica.mjs` over the generated
  // styles.css (700..1400 px in 20 px steps, five identities) and the W-D2 live lab. A floor of 320 px for EVERY identity made a short
  // one (max-content 212 px) need 320 px on the first line, so its hero cluster sat alone on the second line at 920..1000 px sheets
  // where the pre-RIDER-27 layout shared the first line (the Illrigger's, 279 px: 1000..1020). `calc-size(max-content, min(size, 320px))`
  // is min(max-content, 320px): a short identity keeps its own width as the floor, a long one keeps 320 px. The plain floor stays FIRST as
  // the fallback an engine without calc-size() keeps (Obsidian's Chromium 132 has it; it shipped in Chromium 129).
  it("the base identity rule declares the calc-size floor after the plain 320 px fallback", () => {
    const css = read("components.css");
    const at = css.indexOf(".archivist-pc-sheet .pc-identity {");
    const block = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
    expect(block).toMatch(/min-width:\s*min\(100%, 320px\);\s*min-width:\s*calc-size\(max-content, min\(size, 320px\)\);/);
  });
});

describe("R4-G7 fix round 1 · W-D-D6 an EMPTY detail slot gives its track to the name (MEASURED LIVE in W-D2a)", () => {
  // THIS TEST IS NOT THE WITNESS (jsdom lays nothing out); the witness is W-D2a's lab (`lab-W-D2a/passive-*.json`) and W-D2's frames.
  // At the default 355.5 px column `conv-light-domain-5e-20`'s "Divine Intervention Improvement" (217.4 px on one line) sat in
  // `209px 104.5px 18px`: its detail cell was EMPTY (0 child nodes) yet held the `minmax(min-content, 1fr)` third, so the name wrapped
  // while "Channel Divinity: Radiance of the Dawn" (254.9 px), whose spend control sends its detail to its own grid row, read one line
  // in 321.5 px. The same shape wrapped the Illrigger's "Forked Tongue Improvement" / "Infernal Conduit Improvement" and the
  // battle-smith's race row at narrower columns. Injected live over 300..1000 px: 0 names that fit their row still wrapped.
  const block = (selector: string): string => {
    const css = read("actions.css");
    const ix = css.indexOf(selector);
    if (ix < 0) throw new Error(`no rule for ${selector} in actions.css`);
    return css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", ix));
  };
  it("the Actions-tab row with an empty detail keeps the badge, the name and the caret tracks only", () => {
    expect(block(".archivist-pc-sheet .pc-feature-list .pc-feature-row:has(> .pc-feature-detail:empty) {")).toMatch(/grid-template-columns:\s*66px minmax\(0, 1fr\) 18px;/);
  });
  it("the Passive-tab row with an empty detail keeps the name and the caret tracks only", () => {
    expect(block(".archivist-pc-sheet .pc-passive-features-tab .pc-feature-list .pc-feature-row:has(> .pc-feature-detail:empty) {")).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 18px;/);
  });
  it("the empty detail cell itself leaves the grid", () => {
    expect(block(".archivist-pc-sheet .pc-feature-list .pc-feature-row > .pc-feature-detail:empty {")).toMatch(/display:\s*none;/);
  });
});

describe("R4-G7 T8 wave E CSS contracts · B026-D1 the block children a markdown entry can hold", () => {
  const DND = join(__dirname, "..", "packages", "obsidian", "src", "styles");
  const dnd = (): string => readFileSync(join(DND, "archivist-dnd.css"), "utf8");

  // MEASURED LIVE in W-Er (the deployed pair d8f93568 / 04b3ebd4, the default 1024 x 800 window) on all nine battery
  // notes: every one of the 79 non-spellcasting feature cards had its prose on the line BELOW its bold name, the
  // paragraph's first line at x 470.6 (the card's edge, pulled by the inherited -1em hang) and its continuation lines at
  // 484.6. The renderer unwraps the LEAD paragraph; the blocks that remain (a second paragraph, a blockquote, a table)
  // keep their own line and must not inherit the hang the name needs.
  it("a paragraph, blockquote or table inside a feature entry does not inherit the hanging indent", () => {
    const css = dnd();
    const ix = css.indexOf(".archivist-feature-entry :is(p, blockquote, table)");
    expect(ix).toBeGreaterThan(-1);
    const block = css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
    expect(block).toMatch(/text-indent:\s*0/);
  });
});

describe("R4-G7 T8 wave E CSS contracts · B026-D17 / B026-D21 the markdown fills' paragraphs", () => {
  const DND = join(__dirname, "..", "packages", "obsidian", "src", "styles");
  const dnd = (): string => readFileSync(join(DND, "archivist-dnd.css"), "utf8");
  /** The declaration block of the first rule whose selector list contains `selector`, in archivist-dnd.css. */
  const blockFor = (selector: string): string => {
    const css = dnd();
    const ix = css.indexOf(selector);
    if (ix < 0) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
  };

  // MEASURED LIVE in W-Er (the deployed pair): paragraph pairs with a 0 px gap on Burney's Regional Effects (1) and
  // Variants (5), Baphomet's Regional Effects (2) and the Turtle's Variants (5).
  it("consecutive paragraphs in a block carry a gap, and so does a feature entry's later paragraph", () => {
    const block = blockFor(".archivist-monster-block p + p");
    expect(block).toMatch(/margin-top:\s*0\.5em/);
    expect(dnd()).toContain(".archivist-monster-block .archivist-feature-entry > p");
  });

  // MEASURED LIVE in W-Er: the Turtle's Lair Actions and Regional Effects paragraphs computed 14px / 16.8px where the
  // feature prose beside them computes 13px / 19.6px (`.archivist-feature`'s 1.4em resolved at the block's 14px).
  it("a markdown-filled pane reads at the feature prose's line height and type size", () => {
    const lh = blockFor('.archivist-monster-section[data-fill="markdown"] > :not(.actions-header, table)');
    expect(lh).toMatch(/line-height:\s*19\.6px/);
    const fs = blockFor('.archivist-monster-section[data-fill="markdown"] :is(p, li)');
    expect(fs).toMatch(/font-size:\s*13px/);
  });

  // MEASURED LIVE in W-Er on five generated intros: margin-bottom 0px, font-size 14px, line-height 16.8px, because the
  // block's `p` reset (0,1,1) outranked the bare `.archivist-legendary-intro` arm (0,1,0).
  it("the legendary / reactions intro states its own type at a specificity the block's p reset cannot beat", () => {
    expect(dnd()).toContain(".archivist-monster-block p.archivist-legendary-intro");
    const block = blockFor(".archivist-monster-block .legendary-intro");
    expect(block).toMatch(/margin:\s*0\.25em 0 0\.5em/);
    expect(block).toMatch(/font-size:\s*13px/);
    expect(block).toMatch(/line-height:\s*1\.4em/);
  });
});

describe("R4-G7 T8 wave E CSS contracts · B026-D4 the tag's own halves", () => {
  const DND = join(__dirname, "..", "packages", "obsidian", "src", "styles");
  const dnd = (): string => readFileSync(join(DND, "archivist-dnd.css"), "utf8");
  const blockFor = (selector: string): string => {
    const css = dnd();
    const ix = css.indexOf(selector);
    if (ix < 0) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
  };

  // MEASURED LIVE in W-Er (the deployed pair): Andir's Variants table broke 10 of its 10 tags across lines, the SRD
  // Aboleth's Actions, Baphomet's Regional Effects and the Turtle's Legendary Actions one each; on the PC sheet the
  // Illrigger's Greatsword row had two of three damage tags in two fragments, one with its icon on another line than
  // its value. With `white-space: nowrap` injected live, every one of those tags read ONE fragment, icon and value
  // together, and the widest still ended 15.6 px inside the damage cell.
  it("both tag families are unbreakable, and so is the wrapper that binds one to its '('", () => {
    expect(blockFor(".archivist-stat-tag {")).toMatch(/white-space:\s*nowrap/);
    expect(blockFor(".archivist-tag {")).toMatch(/white-space:\s*nowrap/);
    expect(blockFor(".archivist-tag-nobreak")).toMatch(/white-space:\s*nowrap/);
  });
});

describe("R4-G7 T8 wave E CSS contracts · B026-D8 a markdown section's table cells", () => {
  const DND = join(__dirname, "..", "packages", "obsidian", "src", "styles");
  const dnd = (): string => readFileSync(join(DND, "archivist-dnd.css"), "utf8");
  const blockFor = (selector: string): string => {
    const css = dnd();
    const ix = css.indexOf(selector);
    if (ix < 0) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)));
  };

  // MEASURED LIVE in W-Er: Andir's Variants table computed `left, center, center` while the note asks `text-center` for
  // the Level column only, and Baphomet's Regional table's first column read 2 lines per cell (`01–` over `20`). The
  // alignment arrives as an `align` attribute (the W-Er table lab). Corpus: the longest first-column cell in all 31
  // entry-tree tables is 5 characters.
  it("a section table's cells read start, take their column's align attribute, and the first column does not break", () => {
    expect(blockFor(".archivist-monster-section table.archivist-table td,")).toMatch(/text-align:\s*start/);
    expect(blockFor('.archivist-monster-section table.archivist-table :is(td, th)[align="center"]')).toMatch(/text-align:\s*center/);
    expect(blockFor('.archivist-monster-section table.archivist-table :is(td, th)[align="right"]')).toMatch(/text-align:\s*right/);
    expect(blockFor(".archivist-monster-section table.archivist-table td:first-child")).toMatch(/white-space:\s*nowrap/);
  });

  // the shared brick rule the arms above override must still be the one the spell and item tables read
  it("the programmatic tables keep the centred cells the brick rule gives them", () => {
    const css = dnd();
    const ix = css.indexOf(".archivist-monster-block table.archivist-table td {");
    expect(ix).toBeGreaterThan(-1);
    expect(css.slice(css.indexOf("{", ix) + 1, css.indexOf("}", css.indexOf("{", ix)))).toMatch(/text-align:\s*center/);
    // and the section arms come AFTER it, which is what makes them win at equal specificity
    expect(css.indexOf(".archivist-monster-section table.archivist-table td,")).toBeGreaterThan(ix);
  });
});
