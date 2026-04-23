import { MarkdownRenderer, type Component } from "obsidian";
import type { SheetComponent, ComponentRenderContext } from "./component.types";

export class NotesTab implements SheetComponent {
  readonly type = "notes-tab";

  constructor(private readonly component?: Component) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-notes-body" });
    const notes = ctx.resolved.definition.notes ?? "";
    if (!notes.trim()) {
      root.createDiv({ cls: "pc-empty-line", text: "No notes." });
      return;
    }
    const target = root.createDiv({ cls: "pc-notes-markdown" });
    const app = (ctx.core as unknown as { app?: unknown }).app;
    void MarkdownRenderer.render(app as never, notes, target, "", this.component as unknown as never);
  }
}
