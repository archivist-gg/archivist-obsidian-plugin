import { MarkdownRenderer, Component, type App } from "obsidian";

/**
 * Render a markdown string into `parent` using Obsidian's native renderer,
 * then post-process for archivist conventions.
 *
 * Post-processing:
 *   1. Every <table> gets class="archivist-table" so the brick CSS in
 *      archivist-dnd.css matches it.
 *   2. (Future) Dice-tag <code> elements (d:2d6, dc:15, atk:STR) get
 *      replaced with clickable widgets — wired in Task 1.4.
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
  if (!markdown || markdown.length === 0) return;

  const comp = component ?? new Component();
  // App is optional in tests; in production it must be passed. The test mock
  // ignores the argument anyway.
  await MarkdownRenderer.render(app as App, markdown, parent, "", comp);

  // Tag every rendered table for the brick CSS rules.
  parent.querySelectorAll("table").forEach((t) => {
    t.classList.add("archivist-table");
  });
}
