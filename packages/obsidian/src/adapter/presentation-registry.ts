import type { RenderContext, EditContext, ModalConstructor } from "../core/module-api";

/**
 * Bridge 2 (presentation): holds a legacy module's DOM-facing callbacks
 * (render / edit / insert-modal) keyed by code-block type. The kernel owns
 * parsing; this registry owns rendering. Together they replace direct
 * `mod.render` / `mod.renderEditMode` dispatch in the code-block processor.
 */
export interface Presentation {
  render?(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement | void;
  renderEditMode?(el: HTMLElement, data: unknown, ctx: EditContext): void;
  getInsertModal?(): ModalConstructor | null;
}

export class PresentationRegistry {
  private map = new Map<string, Presentation>();
  set(type: string, p: Presentation): void { this.map.set(type, p); }
  get(type: string): Presentation | undefined { return this.map.get(type); }
}
