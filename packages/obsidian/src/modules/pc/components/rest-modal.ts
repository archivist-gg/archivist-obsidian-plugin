// src/modules/pc/components/rest-modal.ts
import { Modal, type App } from "obsidian";
import type { DerivedStats, ResolvedCharacter } from "../pc.types";
import type { CharacterEditState } from "../pc.edit-state";
import type { EntityRegistry } from "../../../shared/entities/entity-registry";
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
    private registry: EntityRegistry | null = null,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    // `archivist-modal` brings the shared parchment frame, tokens, checkbox,
    // and primary-button theme. `pc-rest-modal` adds rest-specific layout.
    this.contentEl.addClass("archivist-modal", "pc-rest-modal");
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
    return computeRestPlan(character, this.resolved, this.derived, this.registry, this.type);
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
      });
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

    this.renderHdButtons(strip);
    this.renderRollLog(strip);
  }

  private renderHdButtons(strip: HTMLElement): void {
    const totalSelected = Array.from(this.selectedPips.values()).reduce((s, n) => s + n, 0);
    const row = strip.createDiv({ cls: "pc-rest-hd-buttons" });

    // Note: class is `pc-rest-btn-roll`, NOT `pc-rest-btn-confirm`. The footer's
    // Confirm button also uses `pc-rest-btn-confirm`; using a distinct class
    // for the HD-spend button keeps test selectors unambiguous.
    const rollBtn = row.createEl("button", {
      cls: "pc-rest-btn-roll",
      text: totalSelected > 0 ? `⚄ Roll & Apply ${totalSelected}` : "⚄ Roll & Apply",
    });
    rollBtn.disabled = totalSelected === 0;
    rollBtn.addEventListener("click", () => this.commitHdSpend("roll"));

    const avgAmount = this.previewAvgHeal();
    const avgBtn = row.createEl("button", {
      cls: "pc-rest-btn-outline",
      text: totalSelected > 0 ? `Apply Avg +${avgAmount}` : "Apply Avg",
    });
    avgBtn.disabled = totalSelected === 0;
    avgBtn.addEventListener("click", () => this.commitHdSpend("avg"));

    const manualBtn = row.createEl("button", {
      cls: this.manualOpen ? "pc-rest-btn-outline active" : "pc-rest-btn-outline",
      text: "✎ manual",
    });
    manualBtn.disabled = totalSelected === 0;
    manualBtn.addEventListener("click", () => {
      this.manualOpen = !this.manualOpen;
      this.render();
    });

    if (this.manualOpen) {
      const wrap = row.createSpan({ cls: "pc-rest-manual-input" });
      wrap.createSpan({ cls: "pc-rest-manual-label", text: "Heal" });
      const input = wrap.createEl("input", {
        cls: "pc-rest-manual-number",
        attr: { type: "number", min: "0", inputmode: "numeric" },
      });
      activeWindow.setTimeout(() => input.focus(), 0);
      const apply = wrap.createEl("button", {
        cls: "pc-rest-btn-roll pc-rest-btn-roll--small",
        text: "Apply",
      });

      const submit = () => {
        // Reject empty submissions explicitly: `Number("")` is 0, which would
        // otherwise pass the finite/≥0 guard below and burn HD for a 0-value
        // heal (plus CON mod × spends). Shake the input the same way other
        // invalid entries do so the affordance is consistent.
        if (input.value.trim() === "") {
          input.addClass("shake");
          activeWindow.setTimeout(() => input.removeClass("shake"), 250);
          return;
        }
        const raw = Number(input.value);
        if (!Number.isFinite(raw) || raw < 0) {
          input.addClass("shake");
          activeWindow.setTimeout(() => input.removeClass("shake"), 250);
          return;
        }
        // Cap at sum of selected dice maxes
        let cap = 0;
        for (const [die, n] of this.selectedPips.entries()) {
          cap += Number(die.replace("d", "")) * n;
        }
        const value = Math.min(raw, cap);
        if (value !== raw) {
          input.value = String(value);
          input.addClass("shake");
          activeWindow.setTimeout(() => input.removeClass("shake"), 250);
        }
        // Apply across pools; manual heals are split proportionally across pools
        // when multiple pools are selected — simplest behavior is to apply the
        // value once per pool entry. For SP4b scope, the modal rarely runs with
        // multiple pools selected at once; we spend each pool's selected dice
        // and apply the typed value as the TOTAL (not per-die).
        const conMod = this.conMod();
        let totalSpends = 0;
        for (const [die, n] of this.selectedPips.entries()) {
          for (let i = 0; i < n; i++) {
            this.editState.spendHitDie(die);
            totalSpends++;
          }
          this.rollLog.push({ die, value, tag: "manual" });
        }
        this.editState.heal(value + conMod * totalSpends);
        this.selectedPips.clear();
        this.manualOpen = false;
        this.render();
      };
      apply.addEventListener("click", submit);
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          this.manualOpen = false;
          this.render();
        }
      });
    }
  }

  private previewAvgHeal(): number {
    const conMod = this.conMod();
    let total = 0;
    for (const [die, n] of this.selectedPips.entries()) {
      const max = Number(die.replace("d", ""));
      total += n * (Math.floor(max / 2) + 1 + conMod);
    }
    return total;
  }

  private conMod(): number {
    // Derived stats may not expose CON mod directly; compute from abilities.
    const con = this.editState.getCharacter().abilities.con ?? 10;
    return Math.floor((con - 10) / 2);
  }

  private commitHdSpend(mode: "roll" | "avg"): void {
    const conMod = this.conMod();
    for (const [die, n] of this.selectedPips.entries()) {
      const max = Number(die.replace("d", ""));
      for (let i = 0; i < n; i++) {
        const v = mode === "roll" ? 1 + Math.floor(Math.random() * max) : Math.floor(max / 2) + 1;
        this.editState.spendHitDie(die);
        this.editState.heal(v + conMod);
        this.rollLog.push({ die, value: v, tag: mode === "avg" ? "avg" : undefined });
      }
    }
    this.selectedPips.clear();
    this.manualOpen = false;
    this.render();
  }

  private renderRollLog(strip: HTMLElement): void {
    if (this.rollLog.length === 0) return;
    const log = strip.createDiv({ cls: "pc-rest-roll-log" });
    for (const entry of this.rollLog) {
      const line = log.createDiv({ cls: "pc-rest-roll-line" });
      line.createSpan({ text: `${entry.die} ⇒ ` });
      const v = line.createEl("strong");
      v.setText(String(entry.value));
      if (entry.tag) {
        line.createSpan({ cls: "pc-rest-roll-tag", text: entry.tag });
      }
    }
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
