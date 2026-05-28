// src/modules/pc/components/rest-modal.ts
import { Modal, type App } from "obsidian";
import type { DerivedStats, ResolvedCharacter } from "../pc.types";
import type { CharacterEditState } from "../pc.edit-state";
import {
  computeRestPlan,
  type RestCategoryId,
  type RestPlan,
  type RestType,
} from "../pc.rest";

/**
 * Itemized opt-out rest modal. Short rest also exposes the HD-spend strip
 * (added in Slice 5). HD spends fire editState primitives immediately;
 * opt-out resets commit only on Confirm.
 */
export class RestModal extends Modal {
  private optouts = new Set<RestCategoryId>();
  private rollLog: Array<{ die: string; value: number; tag?: "manual" | "avg" }> = [];
  private manualOpen = false;
  private selectedPips = new Map<string, number>();

  constructor(
    app: App,
    private editState: CharacterEditState,
    private resolved: ResolvedCharacter,
    private derived: DerivedStats,
    private type: RestType,
    private onCloseCallback?: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("pc-rest-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    this.onCloseCallback?.();
  }

  /** Recompute plan from current state and re-render. Cheap. */
  private render(): void {
    this.contentEl.empty();
    const plan = this.currentPlan();

    // Title
    const titleEl = this.contentEl.createEl("h2", { cls: "pc-rest-modal-title" });
    titleEl.setText(this.type === "short" ? "☾ Short Rest" : "★ Long Rest");

    // HD strip (short rest only)
    if (this.type === "short") {
      this.renderHdStrip(plan);
    }

    // Opt-out list
    this.renderOptList(plan);

    // Footer
    this.renderFooter();
  }

  private currentPlan(): RestPlan {
    // Read live character from editState so re-renders see the latest
    const character = this.editState.getCharacter();
    return computeRestPlan(character, this.resolved, this.derived, null, this.type);
  }

  private renderOptList(plan: RestPlan): void {
    if (plan.categories.length === 0) {
      this.contentEl.createDiv({
        cls: "pc-rest-modal-empty",
        text: "Nothing to restore.",
      });
      return;
    }
    const label = this.contentEl.createDiv({
      cls: "pc-rest-modal-section-label",
      text: "Resources to restore",
    });
    label.setAttr("aria-hidden", "true");
    const list = this.contentEl.createEl("ul", { cls: "pc-rest-opt-list" });
    for (const cat of plan.categories) {
      const li = list.createEl("li", { cls: "pc-rest-opt-row" });
      if (this.optouts.has(cat.id)) li.addClass("opt-out");
      const checkbox = li.createEl("input", {
        cls: "pc-rest-opt-checkbox",
        attr: { type: "checkbox" },
      }) as HTMLInputElement;
      checkbox.checked = !this.optouts.has(cat.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.optouts.delete(cat.id);
        else this.optouts.add(cat.id);
        li.toggleClass("opt-out", !checkbox.checked);
      });
      li.createSpan({ cls: "pc-rest-opt-label", text: cat.label });
      li.createSpan({ cls: "pc-rest-opt-preview", text: cat.preview });
    }
  }

  private renderHdStrip(plan: RestPlan): void {
    if (plan.hdAvailable.length === 0) return; // no pip rows if no HD left

    this.contentEl.createDiv({
      cls: "pc-rest-modal-section-label",
      text: "Spend Hit Dice",
    });
    const strip = this.contentEl.createDiv({ cls: "pc-rest-hd-strip" });

    for (const pool of plan.hdAvailable) {
      const character = this.editState.getCharacter();
      const hd = character.state.hit_dice[pool.die];
      const row = strip.createDiv({ cls: "pc-rest-pip-row" });
      row.createSpan({ cls: "pc-rest-pip-label", text: pool.die });
      const total = hd.total;
      const spent = hd.used;
      const selected = this.selectedPips.get(pool.die) ?? 0;
      for (let i = 0; i < total; i++) {
        const pip = row.createDiv({ cls: "pc-rest-pip" });
        if (i < spent) pip.addClass("spent");
        else if (i < spent + selected) pip.addClass("selected");
        // Else: empty (available)
        pip.addEventListener("click", () => {
          if (i < spent) return;
          const cur = this.selectedPips.get(pool.die) ?? 0;
          if (i < spent + cur) {
            // Click on a selected pip → deselect down to it
            this.selectedPips.set(pool.die, i - spent);
          } else {
            // Click on an empty pip → select up to and including it
            this.selectedPips.set(pool.die, i - spent + 1);
          }
          this.render();
        });
      }
    }

    // Buttons row populated in Task 16
    strip.createDiv({ cls: "pc-rest-hd-buttons" });
  }

  private renderFooter(): void {
    const footer = this.contentEl.createDiv({ cls: "pc-rest-modal-footer" });
    const cancel = footer.createEl("button", {
      cls: "pc-rest-btn-ghost",
      text: "Cancel",
    });
    cancel.addEventListener("click", () => this.close());
    const confirm = footer.createEl("button", {
      cls: "pc-rest-btn-confirm",
      text: "Confirm",
    });
    confirm.addEventListener("click", () => {
      if (this.type === "short") this.editState.shortRest(this.optouts);
      else this.editState.longRest(this.optouts);
      this.close();
    });
  }
}
