import { MarkdownRenderer, Component, type App } from "obsidian";
import { parseInlineTag } from "./inline-tag-parser";
import { renderInlineTag } from "./inline-tag-renderer";

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
    // App is optional in tests; in production it must be passed. The test mock
    // ignores the argument anyway.
    await MarkdownRenderer.render(app as App, markdown, parent, "", comp);
  }

  // Tag every rendered table for the brick CSS rules.
  parent.querySelectorAll("table").forEach((t) => {
    t.classList.add("archivist-table");
  });

  // Dice-tag swap. MarkdownRenderer renders backtick-wrapped tokens as <code>;
  // walk and replace recognized tags (d:2d6, dc:15, atk:STR, …) with widgets.
  const codes = Array.from(parent.querySelectorAll("code"));
  for (const code of codes) {
    const text = code.textContent ?? "";
    const parsed = parseInlineTag(text);
    if (!parsed) continue;
    const widget = renderInlineTag(parsed, parent.ownerDocument ?? activeDocument);
    code.replaceWith(widget);
  }
}
