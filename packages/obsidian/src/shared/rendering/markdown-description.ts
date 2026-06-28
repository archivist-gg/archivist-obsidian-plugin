import { MarkdownRenderer, Component, type App } from "obsidian";
import { parseInlineTag } from "./inline-tag-parser";
import { convert5eToolsTags, renderStatBlockTag } from "./renderer-utils";

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
 * Async because MarkdownRenderer.render is async. Callers (spell, item,
 * class renderers) await this; their renderer functions become async.
 */
export async function renderMarkdownDescription(
  parent: HTMLElement,
  markdown: string,
  app?: App,
  component?: Component,
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
    const decorated = convert5eToolsTags(markdown);
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
    const tagType = oldWidget.getAttribute("data-dice-type");
    const tagContent = oldWidget.getAttribute("data-dice-notation");
    let parsed = null;
    if (tagType && tagContent) {
      parsed = parseInlineTag(`${tagType}:${tagContent}`);
    } else {
      // Non-rollable widgets (dc/check) don't carry data attrs; fall back to
      // re-parsing the text content. The widget format is "<icon><text>" so
      // textContent will be just the rendered text — only useful if the text
      // matches a parseable tag, which dc/check don't (they're already formatted).
      parsed = parseInlineTag(oldWidget.textContent ?? "");
    }
    if (!parsed) return;
    const widget = renderStatBlockTag(parsed, undefined, doc);
    oldWidget.replaceWith(widget);
  });
  parent.querySelectorAll("code").forEach((code) => {
    const parsed = parseInlineTag(code.textContent ?? "");
    if (!parsed) return;
    const widget = renderStatBlockTag(parsed, undefined, doc);
    code.replaceWith(widget);
  });
}
