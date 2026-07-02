import type { App, Editor } from "obsidian";

export interface RenderContext {
  plugin: unknown;
  ctx: unknown;
  /** Optional column layout hint. Presenters that declare `supportsColumns`
   *  read this; others ignore it. */
  columns?: number;
}

export interface EditContext extends RenderContext {
  source: string;
  /** Called by the presenter's edit-mode renderer to exit back to view mode
   *  when no content change triggers Obsidian to re-render the block
   *  (e.g. cancel with no edits, save with identical YAML). */
  onExit?: () => void;
  /** Optional compendium provenance when editing a {{type:slug}} ref from
   *  compendium-ref-extension. Present for compendium-sourced blocks, absent
   *  when editing an inline code-fence. */
  compendium?: { slug: string; compendium: string; readonly: boolean };
  /** Replace the {{type:slug}} text in the host document. Provided by the
   *  compendium-ref caller; unused by the standard code-block processor. */
  onReplaceRef?: (newRefText: string) => void;
}

/**
 * The constructor shape a presenter's "Insert entity" modal must satisfy.
 */
export type ModalConstructor = new (app: App, editor: Editor) => { open(): void };

/**
 * The renderer contract for one authored entity type: how the type is DRAWN
 * (view render, edit-mode UI, insert modal). Parsing is the kernel's job —
 * a presenter never parses. `type` is simultaneously the code-block language,
 * the compendium entityType, and the insert-command suffix (verified identical
 * for all 11 authored types).
 */
export interface EntityPresenter {
  type: string;
  /** Whether render() honors RenderContext.columns (column toggle shown). */
  supportsColumns?: boolean;
  /** Render entity into el; return the appended node so swap-callers
   *  (column toggle) can replace it. Returning void is permitted. */
  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement | void;
  renderEditMode?(el: HTMLElement, data: unknown, ctx: EditContext): void;
  getInsertModal?(): ModalConstructor | null;
}
