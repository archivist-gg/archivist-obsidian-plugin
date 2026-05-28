// src/modules/pc/components/rest-buttons.ts
import type { ComponentRenderContext } from "./component.types";
import { RestModal } from "./rest-modal";

/**
 * Hero rest cluster: ☾ short rest and ★ long rest, both filled crimson,
 * stacked vertically at the right edge of the hero, after the Hit Dice
 * widget. Icon-only — hover reveals the full label via the title attr.
 *
 * Buttons are always enabled (narrative-friendly — a player may invoke
 * a rest even with nothing mechanical to restore; the modal then shows
 * "Nothing to restore."). The only disable is during an open modal to
 * preserve the single-modal invariant.
 */
export class RestButtons {
  private shortBtn!: HTMLButtonElement;
  private longBtn!: HTMLButtonElement;
  private modalOpen = false;

  constructor(private host: HTMLElement, private ctx: ComponentRenderContext) {}

  render(): void {
    this.host.empty();
    const wrap = this.host.createDiv({ cls: "pc-rest-cluster" });
    this.shortBtn = wrap.createEl("button", {
      cls: "pc-rest-btn pc-rest-btn--short",
      text: "☾",
      attr: { "aria-label": "short rest" },
    });
    this.longBtn = wrap.createEl("button", {
      cls: "pc-rest-btn pc-rest-btn--long",
      text: "★",
      attr: { "aria-label": "long rest" },
    });

    this.shortBtn.addEventListener("click", () => this.open("short"));
    this.longBtn.addEventListener("click", () => this.open("long"));

    this.refreshDisabledState();
  }

  private open(type: "short" | "long"): void {
    if (this.modalOpen) return;
    const { app, editState, resolved, derived } = this.ctx;
    if (!app || !editState) return;
    this.modalOpen = true;
    this.refreshDisabledState();
    // Thread the registry handle into the modal so its plan preview can
    // resolve `[[item-slug]]` references to display names. Without it,
    // resolveItemName returns undefined and the label falls back to the
    // raw slug.
    const registry = editState.getRegistry();
    const modal = new RestModal(app, editState, resolved, derived, type, () => {
      this.modalOpen = false;
      this.refreshDisabledState();
    }, registry);
    modal.open();
  }

  private refreshDisabledState(): void {
    // Only the open-modal lock disables — see class JSDoc for rationale.
    this.shortBtn.disabled = this.modalOpen;
    this.shortBtn.title = "short rest";
    this.longBtn.disabled = this.modalOpen;
    this.longBtn.title = "long rest";
  }
}
