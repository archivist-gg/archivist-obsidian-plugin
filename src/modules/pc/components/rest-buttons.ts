// src/modules/pc/components/rest-buttons.ts
import type { ComponentRenderContext } from "./component.types";
import { computeRestPlan } from "../pc.rest";
import { RestModal } from "./rest-modal";

/**
 * Hero rest cluster: ☾ short rest (outline) and ★ long rest (solid),
 * stacked vertically at the right edge of the hero, after the Hit Dice
 * widget. Icon-only — hover reveals the full label via the title attr.
 *
 * Owns its own disabled state — short button is disabled when HP=0 OR
 * when there's nothing to rest; long button disabled only when there's
 * nothing to rest. When either modal opens, both buttons disable until
 * the modal closes (single-modal invariant).
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
    const { resolved, derived } = this.ctx;
    const hpZero = resolved.state.hp.current === 0;
    const shortPlan = computeRestPlan(resolved.definition, resolved, derived, null, "short");
    const longPlan = computeRestPlan(resolved.definition, resolved, derived, null, "long");
    const nothingShort = shortPlan.categories.length === 0 && shortPlan.hdAvailable.length === 0;
    const nothingLong = longPlan.categories.length === 0;

    this.shortBtn.disabled = this.modalOpen || hpZero || nothingShort;
    this.shortBtn.title = hpZero ? "cannot rest while unconscious"
      : nothingShort ? "short rest — nothing to restore"
      : "short rest";

    this.longBtn.disabled = this.modalOpen || nothingLong;
    this.longBtn.title = nothingLong ? "long rest — nothing to restore" : "long rest";
  }
}
