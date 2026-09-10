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
 *
 * HARDENED at T8 (T6 review Minor 4): the escape now covers EVERY regex metacharacter (the old class
 * missed `*`, `+`, `?`, `^`, `$`, `{`, `}`, `|`, so a selector carrying one would have been read as a
 * pattern), and a RULE BOUNDARY is required before the selector (the start of the file, or a `}`, a
 * `;` or a newline, then optional whitespace). Without the boundary a queried selector that is a
 * SUFFIX of an earlier rule's selector (`.pc-cap-host` against `.archivist-pc-sheet .pc-cap-host`)
 * read the EARLIER block and the row asserted against the wrong declarations.
 */
const ruleInText = (css: string, selector: string, where: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp("(?:^|[};]|\\n)\\s*" + escaped + "\\s*\\{([^}]+)\\}"));
  expect(match, `${selector} rule missing from ${where}`).toBeTruthy();
  return (match as RegExpMatchArray)[1];
};

const ruleOf = (cssPath: string, selector: string): string =>
  ruleInText(readFileSync(resolve(STYLES_DIR, cssPath), "utf8"), selector, cssPath);

/** The whole partial, for the rows that assert a declaration appears NOWHERE ELSE. */
const cssOf = (cssPath: string): string => readFileSync(resolve(STYLES_DIR, cssPath), "utf8");

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

describe("R4-G6b CSS contracts · §10 the separated-caption primitive (components.css)", () => {
  it("the sheet declares the clip margin and the inter-part gap as tokens", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet");
    expect(block).toMatch(/--pc-cap-clip:\s*2px/);
    expect(block).toMatch(/--pc-cap-gap:\s*0\.75em/);
  });

  it("the host clips horizontally ONLY, with the clip margin as slack", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-cap-host");
    // `clip`, never `hidden`: `hidden` would make the host a scroll container and cut the other axis.
    expect(block).toMatch(/overflow-x:\s*clip/);
    expect(block).not.toMatch(/overflow-x:\s*hidden/);
    expect(block).toMatch(/overflow-y:\s*visible/);
    expect(block).toMatch(/overflow-clip-margin:\s*var\(--pc-cap-clip\)/);
  });

  it("the word-spacing rides on pc-cap-spaced ALONE, outside the two `normal` resets", () => {   // m18's kill row
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-cap-spaced");
    expect(block).toMatch(/word-spacing:\s*var\(--pc-cap-gap\)/);
    // The two flex hosts supply their own `gap` and never carry this class, so their non-unit
    // children keep today's spacing: the ONLY widened declaration in the partial is this one, and
    // the only other two are the unit's and the segment's resets, in that order.
    const decls = Array.from(cssOf("components.css").matchAll(/word-spacing:\s*([^;]+);/g)).map((m) => m[1].trim());
    expect(decls).toEqual(["var(--pc-cap-gap)", "normal", "normal"]);
  });

  it("the unit is the positioning context, unbreakable, and resets the inherited spacing", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-cap-unit");
    expect(block).toMatch(/position:\s*relative/);
    expect(block).toMatch(/white-space:\s*nowrap/);
    expect(block).toMatch(/word-spacing:\s*normal/);
  });

  it("the segment resets the inherited spacing too", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-cap-seg");
    expect(block).toMatch(/word-spacing:\s*normal/);
  });

  it("the separator is out of flow, anchored the clip margin outside the unit's left edge", () => {
    const block = ruleOf("components.css", ".archivist-pc-sheet .pc-cap-sep");
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).toMatch(/right:\s*calc\(100% \+ var\(--pc-cap-clip\)\)/);
    expect(block).toMatch(/top:\s*0/);
    // `pre` keeps the trailing space the composed `textContent` needs (invariant 9).
    expect(block).toMatch(/white-space:\s*pre/);
  });
});

describe("R4-G6b CSS contracts · §10.2 the two flex hosts' raised gaps (actions.css)", () => {
  // Measured live 2026-09-09 (`g6b-t8-sep-width.txt`): the `/ ` box is 7.328 px in the caption face
  // at 11 px, so `.pc-charge-boxes` needs 9.328 px and its shipped 8 px was short; the `· ` box is
  // 6.344 px in the sheet face at 12 px, so `.pc-point-pool` needs 8.344 px and its shipped 0.35em
  // (4.2 px at 12 px) was short.
  //
  // T13 live rider R-2: clearing the requirement is not enough. The 10 px
  // `var(--pc-space-2) + var(--pc-cap-clip)` left the `/ ` mark 0.672 px of LEFT air where the OLD
  // build's plain ` / ` text had a whole space (3.031 px) on each side, and the eye read the mark as
  // glued to the last pip on every Passive shot (B5-1, B1 N-2, B2, B9 N-2). Both gaps now carry the
  // requirement PLUS 3 px of air: 13 px on the charge boxes (3.672 px of air) and 12 px on the point
  // pool (3.656 px at its 12 px type, 2.594 px at the 14 px variant).
  it("the charge boxes leave the recovery caption's separator 3 px of air", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-charge-boxes");
    expect(block).toMatch(/gap:\s*calc\(var\(--pc-space-2\) \+ var\(--pc-cap-clip\) \+ 3px\)/);
  });

  it("the point pool leaves the reset caption's separator 3 px of air", () => {
    const block = ruleOf("actions.css", ".archivist-pc-sheet .pc-point-pool");
    expect(block).toMatch(/gap:\s*calc\(var\(--pc-space-2\) \+ var\(--pc-cap-clip\) \+ 2px\)/);
    expect(block).not.toMatch(/gap:\s*0\.35em/);
  });
});

describe("R4-G6b CSS contracts · §7 the sticky builder rail (layout.css, builder.css)", () => {
  // T0's live probe (2026-09-09, `g6b-t0-probe.txt` blocks A and B) measured
  // `.archivist-pc-sheet.parentElement === .view-content` and `.view-content` computing
  // `overflow: auto` on both axes with `transform: none`, `filter: none`, `contain: none`,
  // `position: static`: the PANE is the scroller, so the sticky needs no re-host. The root
  // rule's own `overflow` is the only thing that stood in the way.
  it("the sheet root clips without creating a scroll container", () => {   // m19's kill row
    const block = ruleOf("layout.css", ".archivist-pc-sheet");
    expect(block).toMatch(/overflow:\s*clip/);
    // `hidden` made the root the nearest scroll container, so nothing inside could stick.
    // Fix round 1 (F-7 / M-3): `ruleOf` returns the block's RAW text, COMMENTS INCLUDED, so this negative match is
    // coupled to the prose inside the rule as well as its declarations. It passes today only because layout.css's
    // own comment says "`hidden` made the sheet the nearest scroll container" without writing `overflow: hidden`;
    // a future comment that spells the pair out would false-fail this row without the CSS changing at all.
    expect(block).not.toMatch(/overflow:\s*hidden/);
    expect(block).toMatch(/display:\s*flow-root/);
  });

  it("the step list pins to the pane top", () => {
    const block = ruleOf("builder.css", ".archivist-pc-sheet .pc-builder-rail-steps");
    expect(block).toMatch(/position:\s*sticky/);
    expect(block).toMatch(/top:\s*0/);
  });
});

/**
 * T10 (spec §8.2) reads a selector INSIDE one `@container` block. `.archivist-pc-sheet .pc-sidebar` and
 * `.archivist-pc-sheet .pc-content` exist BOTH as base rules and inside the 499 tier, and `ruleOf` returns the
 * FIRST match, which is the base rule: the 499 tier's own declarations are only reachable by slicing its block
 * first. `query` is the text between `@container` and the opening brace.
 */
const containerBlock = (cssPath: string, query: string): string => {
  const css = readFileSync(resolve(STYLES_DIR, cssPath), "utf8");
  const head = `@container ${query} {`;
  const start = css.indexOf(head);
  expect(start, `@container ${query} missing from ${cssPath}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = start + head.length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`@container ${query} is unterminated in ${cssPath}`);
};

/** One block's declarations as a property map, so two blocks can be compared property by property. */
const declsOf = (block: string): Record<string, string> =>
  Object.fromEntries(
    block
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d.includes(":"))
      .map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]),
  );

describe("R4-G6b CSS contracts · §8.2 the body-fit collapse (layout.css)", () => {
  const FIT_TIER = "pc-sheet (min-width: 500px)";
  const NARROW_TIER = "pc-sheet (max-width: 499px)";

  it("the measurement class keeps the two-column template and shrinks the cells to their content", () => {
    const block = ruleOf("layout.css", ".archivist-pc-sheet .pc-body.pc-body-measure");
    // Fix round 1 (F-7): §8.1's stated property is EQUALITY with the base `.pc-body` template, not a particular pair
    // of track values: the measurement must happen under the template the two-column dress actually uses. A literal
    // matches both after a drift in only one of them, so the base rule is the expectation.
    expect(declsOf(block)["grid-template-columns"])
      .toBe(declsOf(ruleOf("layout.css", ".archivist-pc-sheet .pc-body"))["grid-template-columns"]);
    // Without `start` both cells stretch to the row and the two rects would be EQUAL every time.
    expect(block).toMatch(/align-items:\s*start/);
  });

  it("the fit class is one column with the narrow tier's body padding", () => {
    const fit = declsOf(ruleOf("layout.css", ".archivist-pc-sheet .pc-body.pc-body-fit-one"));
    const narrow = declsOf(ruleInText(containerBlock("layout.css", NARROW_TIER), ".archivist-pc-sheet .pc-body", NARROW_TIER));
    expect(fit["grid-template-columns"]).toBe("1fr");
    expect(fit.padding).toBe(narrow.padding);
    expect(narrow["grid-template-columns"]).toBe("1fr");
  });

  it("the fit rail restates the 499 tier's sidebar declarations and flows the panels side by side", () => {
    const fit = declsOf(ruleOf("layout.css", ".archivist-pc-sheet .pc-body.pc-body-fit-one .pc-sidebar"));
    const narrow = declsOf(ruleInText(containerBlock("layout.css", NARROW_TIER), ".archivist-pc-sheet .pc-sidebar", NARROW_TIER));
    // Only the SHARED properties are compared: the fit rail ALSO carries `display: grid`,
    // `grid-template-columns` and `gap` (the side-by-side flow), which the 499 tier does not.
    for (const prop of ["padding", "border-right", "border-bottom"]) {
      expect(fit[prop], `${prop} must restate the 499 tier's value`).toBe(narrow[prop]);
    }
    // `.pc-sidebar` is `display: flex; flex-direction: column`, so the template alone would be inert.
    expect(fit.display).toBe("grid");
    expect(fit["grid-template-columns"]).toBe("repeat(auto-fit, minmax(220px, 1fr))");
    expect(fit.gap).toBe("var(--pc-space-3)");
  });

  it("the fit content column restates the 499 tier's padding", () => {
    const fit = declsOf(ruleOf("layout.css", ".archivist-pc-sheet .pc-body.pc-body-fit-one .pc-content"));
    const narrow = declsOf(ruleInText(containerBlock("layout.css", NARROW_TIER), ".archivist-pc-sheet .pc-content", NARROW_TIER));
    expect(fit.padding).toBe(narrow.padding);
  });

  it("both classes live under the min-width tier and carry the root prefix", () => {
    const fitTier = containerBlock("layout.css", FIT_TIER);
    expect(fitTier).toContain(".archivist-pc-sheet .pc-body.pc-body-measure");
    expect(fitTier).toContain(".archivist-pc-sheet .pc-body.pc-body-fit-one");
    // Below 500 px both classes are inert: the narrow tier never mentions them.
    expect(containerBlock("layout.css", NARROW_TIER)).not.toContain("pc-body-fit-one");
    // The prefix is what outranks the base `.archivist-pc-sheet .pc-body` rule: an UNPREFIXED
    // `.pc-body.pc-body-fit-one` rule would tie on specificity and depend on source order.
    expect(cssOf("layout.css")).not.toMatch(/(?:^|[};]|\n)\s*\.pc-body\.pc-body-(?:measure|fit-one)\s*\{/);
  });
});

/**
 * The T13 LIVE riders. Each row guards a rule the live run's finding named; the finding's own
 * measurement is quoted beside it, because jsdom computes no layout and only the re-verify can read
 * the rendered result.
 */
describe("R4-G6b CSS contracts · T13 live rider F-B · carrier 5's unit wraps (actions.css)", () => {
  it("the source sub-label's unit wraps internally, so an over-wide label is not CUT at the 252 px column", () => {
    // Measured at 400x700 on `R4G6b Paladin2024-20 S`: `Oath of Devotion (2024 XPHB) 15` read
    // scrollWidth 176 in a clientWidth 140 box and stopped at `(2024 XP`. The host is a
    // `pc-cap-host` (`overflow-x: clip`) and the unit is `nowrap`, so an over-wide part clips
    // instead of wrapping. Only the UNIT is relaxed: the host still clips, which is what hides a
    // separator that would start a line.
    expect(declsOf(ruleOf("actions.css", ".archivist-pc-sheet .pc-action-row-sub .pc-cap-unit"))["white-space"]).toBe("normal");
  });

  it("the primitive keeps nowrap and stays the separator's containing block for carriers 1 to 4", () => {
    const base = declsOf(ruleOf("components.css", ".archivist-pc-sheet .pc-cap-unit"));
    expect(base["white-space"]).toBe("nowrap");
    // `position: relative` is what anchors `.pc-cap-sep` (`right: calc(100% + var(--pc-cap-clip))`)
    // to the unit; with the unit wrapping, that is its FIRST fragment, so a continuation line
    // carries no mark.
    expect(base.position).toBe("relative");
  });

  it("the relaxation is carrier 5's alone: actions.css states one unit rule and the primitive is untouched", () => {
    expect([...cssOf("actions.css").matchAll(/\.pc-cap-unit\s*\{/g)]).toHaveLength(1);
    expect(cssOf("components.css")).not.toMatch(/\.pc-cap-unit[^{}]*\{[^}]*white-space:\s*normal/);
  });
});

describe("R4-G6b CSS contracts · T13 live rider F-C · the weapons table at the narrow tier (actions.css)", () => {
  const NARROW = "pc-content (max-width: 499px)";

  it("the row and its header drop to two lines over three tracks", () => {
    // At the 252 px content column the five-track template left RANGE 36 px and HIT 27 px, so the
    // header labels overflowed their tracks and printed as `RANGEHIT`, and the body cells (which
    // carried `overflow-wrap: anywhere`) broke mid-word: `1+2 bludgeo` / `ning`, `Shortswo` / `rd`.
    // The sum of the five cells' whole-word minimums is about 305 px, so five tracks cannot fit a
    // 244 px content box at all: the row stacks, on the `.pc-weapon-mastery` full-width precedent.
    const block = containerBlock("actions.css", NARROW);
    const tpl = declsOf(ruleInText(block, ".archivist-pc-sheet .pc-weapons-table .pc-weapon-header.has-mastery", NARROW));
    expect(tpl["grid-template-columns"]).toBe("56px minmax(0, 1fr) minmax(0, 1fr)");
    expect(block).toContain(".archivist-pc-sheet .pc-weapons-table .pc-action-row.has-mastery");
  });

  it("every cell is placed explicitly, header twin and body cell together, so the two grids stay aligned", () => {
    const block = containerBlock("actions.css", NARROW);
    const at = (cls: string) => declsOf(ruleInText(block, `.archivist-pc-sheet .pc-weapons-table .${cls}`, NARROW));
    expect(at("pc-weapon-cost")).toMatchObject({ "grid-column": "1", "grid-row": "1" });
    expect(at("pc-weapon-name")).toMatchObject({ "grid-column": "2 / -1", "grid-row": "1" });
    expect(at("pc-weapon-range")).toMatchObject({ "grid-column": "1", "grid-row": "2" });
    expect(at("pc-weapon-hit")).toMatchObject({ "grid-column": "2", "grid-row": "2" });
    expect(at("pc-weapon-damage")).toMatchObject({ "grid-column": "3", "grid-row": "2" });
    expect(at("pc-weapon-mastery")).toMatchObject({ "grid-column": "1 / -1", "grid-row": "3" });
    // The header's twins are named beside their body cells, so no rule reaches a header cell by position.
    for (const twin of ["header-cost", "header-name", "header-range", "header-hit", "header-damage"]) {
      expect(block).toContain(`.archivist-pc-sheet .pc-weapons-table .pc-weapon-${twin}`);
    }
    expect(block).not.toMatch(/nth-child/);
  });

  it("a body cell breaks between words, never mid-word", () => {
    const block = containerBlock("actions.css", NARROW);
    const cells = declsOf(ruleInText(block, ".archivist-pc-sheet .pc-weapons-table .pc-action-row > *", NARROW));
    expect(cells["overflow-wrap"]).toBe("break-word");
    // `anywhere` is what broke `bludgeoning` in half; it also drops min-content to one character.
    expect(block).not.toMatch(/overflow-wrap:\s*anywhere/);
    // The range cell sheds the base rule's `nowrap` here: in a 56 px track a long `80/320 ft` would
    // otherwise overflow into the HIT cell, which is the collision this rider removes.
    // Matched as literal text: `ruleInText` returns the FIRST rule for a selector, which here is the
    // range cell's PLACEMENT rule above (the row 2 / column 1 pair the previous row asserts).
    expect(block).toMatch(/\.archivist-pc-sheet \.pc-weapons-table \.pc-weapon-range \{ white-space: normal; \}/);
  });
});

describe("R4-G6b CSS contracts · T13 live rider F-D · the feature-row tier vs the one-column flip (actions.css)", () => {
  const NARROW = "pc-content (max-width: 499px)";
  const STACK = "pc-content (max-width: 787px)";

  it("the stacked feature-row tier has its own boundary, above the 499 tier's", () => {
    // THE ARITHMETIC, from the T13 witness (`g6b-t13-row9-report.json`). On the Actions tab the row
    // is `66px minmax(0, 2fr) minmax(min-content, 1fr) 18px` with 8 px gaps inside 4 px padding, so
    // the detail cell reads (C - 116) / 3 for a content column C: 312 px at C = 1052, 224 px at
    // C = 788, 168 px at C = 620 - the three widths the run measured, to the pixel. Q-6's one-column
    // flip widened the 768 window's column from 356 to 620, which lifted the row over the 499
    // boundary and handed the detail 168 px, LESS than the 348 px it had when it spanned the row
    // below the name. The four-column layout is now kept only where the detail cell gets at least
    // the 224 px it has at the narrowest column that ships it today (C = 788, the 1200 window's
    // two-column tab panel, which the ruling pins unchanged): (C - 116) / 3 >= 224 iff C >= 788.
    const block = containerBlock("actions.css", STACK);
    expect(block).toContain(".pc-feature-row:has(> .pc-feature-detail > .pc-spend)");
    expect(block).toContain(".pc-feature-row:has(> .pc-feature-detail > .pc-buff-group)");
    expect(block).toContain(".pc-feature-row:has(> .pc-feature-detail > .pc-feature-track)");
  });

  it("the detail cell spans the row on its own second line, on both tabs' templates", () => {
    const block = containerBlock("actions.css", STACK);
    const detail = declsOf(ruleInText(block, ".archivist-pc-sheet .pc-feature-list .pc-feature-row:has(> .pc-feature-detail > .pc-feature-track) > .pc-feature-detail", STACK));
    expect(detail["grid-column"]).toBe("1 / -1");
    expect(detail["grid-row"]).toBe("2");
    // The Actions tab drops to badge + name + caret, the Passive tab (which has no badge) to name + caret.
    expect(declsOf(ruleInText(block, ".archivist-pc-sheet .pc-feature-list .pc-feature-row:has(> .pc-feature-detail > .pc-feature-track)", STACK))["grid-template-columns"]).toBe("66px minmax(0, 1fr) 18px");
    expect(declsOf(ruleInText(block, ".archivist-pc-sheet .pc-passive-features-tab .pc-feature-list .pc-feature-row:has(> .pc-feature-detail > .pc-feature-track)", STACK))["grid-template-columns"]).toBe("minmax(0, 1fr) 18px");
  });

  it("the 499 tier no longer owns the feature-row tier, and keeps everything else it had", () => {
    const narrow = containerBlock("actions.css", NARROW);
    expect(narrow).not.toContain("pc-feature-row");
    // The rest of that block is untouched by this rider.
    expect(narrow).toContain(".archivist-pc-sheet .pc-attack-table");
    expect(narrow).toContain(".archivist-pc-sheet .pc-weapons-table .pc-weapon-mastery");
  });
});

describe("R4-G6b CSS contracts · T13 live rider R-3 · the odd last rail panel at the two-column band (layout.css)", () => {
  const TWO_COL = "pc-sheet (min-width: 500px) and (max-width: 715px)";

  /** A `--pc-space-N` token's px value, read from the partial that defines it. */
  const space = (n: number): number => {
    const m = cssOf("tokens.css").match(new RegExp("--pc-space-" + n + ":\\s*(\\d+)px"));
    expect(m, `--pc-space-${n} missing from tokens.css`).toBeTruthy();
    return Number((m as RegExpMatchArray)[1]);
  };

  it("the band's upper edge is exactly the sheet width three 220 px rail columns need", () => {
    // THE ARITHMETIC, from the shipped values rather than from the ruling's prose. The rail is
    // `repeat(auto-fit, minmax(220px, 1fr))` with a `--pc-space-3` gap inside a body whose only
    // horizontal padding is `--pc-space-4` on each side, and the sheet ITSELF has no horizontal
    // padding (layout.css), so the `pc-sheet` container width IS the body's outer width. Three
    // columns therefore need 3 * 220 + 2 * gap + 2 * padding, and one pixel below that the grid has
    // TWO columns, which is where an odd last panel sits alone beside a blank cell (B8 D-1).
    const rail = declsOf(ruleOf("layout.css", ".archivist-pc-sheet .pc-body.pc-body-fit-one .pc-sidebar"));
    expect(rail["grid-template-columns"]).toBe("repeat(auto-fit, minmax(220px, 1fr))");
    expect(rail["gap"]).toBe("var(--pc-space-3)");
    expect(declsOf(ruleOf("layout.css", ".archivist-pc-sheet .pc-body.pc-body-fit-one"))["padding"])
      .toBe("0 var(--pc-space-4) var(--pc-space-4)");
    const threeColumns = 3 * 220 + 2 * space(3) + 2 * space(4);
    expect(threeColumns).toBe(716);
    expect(cssOf("layout.css")).toContain(`@container ${TWO_COL} {`);
    expect(TWO_COL).toContain(`max-width: ${threeColumns - 1}px`);
  });

  it("an odd last rail panel spans the row instead of leaving a blank cell beside it", () => {
    const block = containerBlock("layout.css", TWO_COL);
    const decls = declsOf(ruleInText(block, ".archivist-pc-sheet .pc-body.pc-body-fit-one .pc-sidebar > :last-child:nth-child(odd)", TWO_COL));
    expect(decls["grid-column"]).toBe("1 / -1");
    // Scoped to the flipped rail alone: the sheet's OTHER two-column surfaces are untouched.
    expect(block).not.toContain(".pc-content");
  });
});

describe("R4-G6b CSS contracts · T13 live rider R-4 · the feature card's badge never paints over its title (components.css)", () => {
  it("the badge takes part in flow as a right float, at the same offsets the absolute dress had", () => {
    const decls = declsOf(ruleOf("components.css", ".archivist-pc-sheet .pc-resource-card .source-badge"));
    // A float has WIDTH in flow, so the title's line boxes shorten by exactly the badge's own width
    // whatever the badge text is; an absolutely positioned badge has none, which is why the 252 px
    // column printed `SRD 2024` letter-on-letter over `Holy Nimbus` (B9 N-3).
    expect(decls["float"]).toBe("right");
    expect(decls["position"]).toBe("static");
    // The shared dress is `top: 8px; right: 8px` on a block with no padding and no border, so these
    // margins keep the badge exactly where it paints today at every width the eye pass judged clean.
    expect(decls["margin"]).toBe("8px 8px 0 0");
  });
});

describe("R4-G6b CSS contracts · T13 live rider R-5 · the feature card's prose is left-aligned (components.css)", () => {
  it("the card's paragraphs read left-aligned at every width", () => {
    const decls = declsOf(ruleOf("components.css", ".archivist-pc-sheet .pc-resource-card .description-paragraph"));
    expect(decls["text-align"]).toBe("left");
    // No tier: justification is wrong in a 252 px column and it is not what the sheet's own prose
    // does at any width, so the rule carries no container query of its own.
    expect(ruleOf("components.css", ".archivist-pc-sheet .pc-resource-card .description-paragraph")).not.toMatch(/@container/);
  });

  it("no pc partial justifies text", () => {
    // The justification the card inherited comes from the SHARED block dress in
    // `src/styles/archivist-dnd.css`, never from a sheet partial: every alignment the pc partials
    // state is left, right, centre or inherit.
    for (const partial of ["components.css", "actions.css", "layout.css", "spells.css", "blocks.css"]) {
      expect(cssOf(partial)).not.toMatch(/text-align:\s*justify/);
    }
  });
});
