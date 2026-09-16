import { MarkdownRenderer, Component, type App } from "obsidian";
import { parseInlineTag } from "@archivist-gg/dnd5e/inline-tag-parser";
import { convert5eToolsTags } from "@archivist-gg/dnd5e/dnd/prose-tags";
import type { FormulaContext } from "@archivist-gg/dnd5e";
import { bindInlineTagPunctuation, renderStatBlockTag } from "./renderer-utils";

/**
 * Render a markdown string into `parent` using Obsidian's native renderer,
 * then post-process for archivist conventions.
 *
 * Post-processing:
 *   1. Every <table> gets class="archivist-table" so the brick CSS in
 *      archivist-dnd.css matches it.
 *   2. Dice-tag <code> elements (d:2d6, dc:15, atk:STR, …) get replaced
 *      with clickable widgets via the inline-tag walker.
 *
 * `monsterCtx` is the formula context those widgets resolve against: a caller
 * that renders monster prose (Q-11, R4-G7 spec §7.6) passes the monster's
 * abilities and proficiency bonus so `atk:STR+PB` and `dc:WIS` print a number
 * instead of their formula. Every other caller omits it and the widgets read
 * exactly as they always did.
 *
 * Async because MarkdownRenderer.render is async. Callers (spell, item,
 * class renderers) await this; their renderer functions become async.
 */
export async function renderMarkdownDescription(
  parent: HTMLElement,
  markdown: string,
  app?: App,
  component?: Component,
  monsterCtx?: FormulaContext,
): Promise<void> {
  if (!markdown || markdown.length === 0) {
    // Still allow post-processing of any pre-existing <code> the caller
    // staged — useful for the test surface and for callers that pre-stage
    // rendered text. Falls through to the walker below.
  } else {
    const comp = component ?? new Component();
    // Run prose-to-tag decoration first: convert {@damage 8d6} → `damage:8d6`
    // and bare prose dice (8d6, 1d6+1) → backtick-wrapped dice tags. The
    // markdown renderer then turns those into <code> elements which the
    // walker below replaces with widgets.
    // Defensive: normalize any residual literal `\n` (belt-and-suspenders for A2)
    // so embedded-JSON and vault-MD descriptions render identically.
    const decorated = convert5eToolsTags(markdown.replace(/\\n/g, "\n"));
    await MarkdownRenderer.render(app as App, decorated, parent, "", comp);
  }

  // Tag every rendered table for the brick CSS rules.
  parent.querySelectorAll("table").forEach((t) => {
    t.classList.add("archivist-table");
  });

  // Dice-tag swap. Two cases must be handled:
  //
  // 1. The global markdown post-processor in main.ts already replaced
  //    <code>tag</code> elements with .archivist-tag widgets via
  //    renderInlineTag — those use the lighter `.archivist-tag-*` classes,
  //    which clash visually with the .archivist-stat-tag-* widgets used
  //    elsewhere in our blocks (e.g. at_higher_levels). Upgrade them.
  //
  // 2. If the global post-processor was bypassed (e.g. the caller staged
  //    pre-rendered <code> manually), handle bare <code> too.
  //
  // Both branches use renderStatBlockTag so widgets match at_higher_levels.
  const doc = parent.ownerDocument ?? activeDocument;
  parent.querySelectorAll("span.archivist-tag").forEach((oldWidget) => {
    // R4-G7 T8 wave E (B026-D11): read the widget's OWN identity first. `renderInlineTag` stamps `data-tag-type` /
    // `data-tag-content` on every widget it makes, rollable or not, so a `dc:INT` reaches this walker as the tag it was
    // written as and gets rebuilt WITH the caller's formula context. Before that pair existed only `data-dice-*` was
    // available, which the non-rollable tags never carry, and the text fallback below could not parse the rendered
    // "DC INT" back into a tag: the context-free widget survived, on 279 SRD monster notes.
    // The upgrade reaches EVERY caller of this function, not the monster block alone: a `dc:` inside a spell, item,
    // feat, race, background or condition block, or inside a PC feature card or one of the three builder surfaces,
    // now gets the stat-block widget the same block's `at_higher_levels` tags already used. That is safe because
    // `.archivist-stat-tag-dc` paints unscoped ink (#191813, `archivist-dnd.css`) and every one of those hosts is the
    // same PARCHMENT surface: the compendium blocks are the `.archivist-*-block` cards (a condition renders into
    // `archivist-spell-block-wrapper`, `condition.module.ts:44-46`) and all three builder call sites sit inside
    // `.archivist-pc-sheet` (`pc.sheet.ts:58`, `--pc-parchment-light: #fdf1dc`). R4-G7 T8 wave E fix round 1, review
    // Minor 4: the reach was measured but unstated; S03 is the witness for the hosts W-E did not photograph.
    const tagType = oldWidget.getAttribute("data-tag-type") ?? oldWidget.getAttribute("data-dice-type");
    const tagContent = oldWidget.getAttribute("data-tag-content") ?? oldWidget.getAttribute("data-dice-notation");
    let parsed = null;
    if (tagType && tagContent !== null) {
      parsed = parseInlineTag(`${tagType}:${tagContent}`);
    } else {
      // A widget from somewhere else (or an older rendered note left in the DOM): fall back to re-parsing the text
      // content. The widget format is "<icon><text>", so textContent is just the rendered text, which only helps when
      // that text is itself a parseable tag.
      parsed = parseInlineTag(oldWidget.textContent ?? "");
    }
    if (!parsed) return;
    const widget = renderStatBlockTag(parsed, monsterCtx, doc);
    oldWidget.replaceWith(widget);
  });
  parent.querySelectorAll("code").forEach((code) => {
    const parsed = parseInlineTag(code.textContent ?? "");
    if (!parsed) return;
    const widget = renderStatBlockTag(parsed, monsterCtx, doc);
    code.replaceWith(widget);
  });

  // B026-D4 (R4-G7 T8 wave E): the widgets are in place, so bind each to the "(" that opens it. The tag itself is held
  // together by `white-space: nowrap`; the opening punctuation belongs to the prose and needs the shared wrapper.
  bindInlineTagPunctuation(parent);
}
