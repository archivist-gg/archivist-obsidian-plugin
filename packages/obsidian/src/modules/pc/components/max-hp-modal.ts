// src/modules/pc/components/max-hp-modal.ts
import { Modal, type App, type KeymapEventHandler } from "obsidian";
import type { HPBreakdown } from "@archivist-gg/dnd5e/pc/pc.types";
import { parseDieSize } from "@archivist-gg/dnd5e/pc/pc.recalc";
import type { ComponentRenderContext } from "./component.types";
import type { CharacterEditState } from "../pc.edit-state";
import { makeInlineInput, cancelInlineEdit } from "./edit-primitives";

let current: MaxHpModal | null = null;

/** Open the Max HP modal (no-op without editState, matching popover precedent). */
export function openMaxHpModal(ctx: ComponentRenderContext): void {
  if (!ctx.editState) return;
  // Close a stale modal bound to a DIFFERENT character before reusing/opening,
  // so a split-view click on sheet B never repaints sheet A's open modal.
  if (current && ctx.editState !== current.openedWith) current.close();
  if (current) { current.updateContext(ctx); return; }
  const modal = new MaxHpModal(ctx.app, ctx, ctx.editState);
  current = modal;
  modal.open();
}

/** Called from HpWidget.render on every sheet render. Repaints the open modal
 *  from fresh ctx; CLOSES it when editState identity changed (file switch). */
export function refreshMaxHpModal(ctx: ComponentRenderContext): void {
  if (!current) return;
  if (!ctx.editState || ctx.editState !== current.openedWith) { current.close(); return; }
  current.updateContext(ctx);
}

export function closeMaxHpModal(): void {
  current?.close();
}

class MaxHpModal extends Modal {
  constructor(
    app: App,
    private ctx: ComponentRenderContext,
    readonly openedWith: CharacterEditState,
  ) { super(app); }

  onOpen(): void {
    this.contentEl.addClass("archivist-modal", "pc-maxhp-modal");
    // Two-stage Escape (spec §6): Escape #1 cancels an active inline edit
    // (the field's onCancel repaints, modal stays open); Escape #2, or Escape
    // with no edit, closes explicitly.
    // Obsidian's Scope dispatches Escape handlers in REGISTRATION order and
    // stops at the first match, so the Modal constructor's built-in
    // Escape-close would always win over a later-registered handler (verified
    // live). Remove any pre-existing Escape handlers (here, only the built-in)
    // so this modal's two-stage handler is the sole Escape owner. `scope.keys`
    // is internal-but-stable; if it is ever absent this degrades to the old
    // behavior instead of throwing.
    const scopeKeys = (this.scope as unknown as { keys?: KeymapEventHandler[] }).keys;
    if (Array.isArray(scopeKeys)) {
      for (const h of scopeKeys.filter((k) => (k as unknown as { key?: string }).key === "Escape")) {
        this.scope.unregister(h);
      }
    }
    this.scope.register([], "Escape", () => {
      if (!cancelInlineEdit(this.contentEl)) this.close();
      return false;
    });
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    if (current === this) current = null;
  }

  updateContext(ctx: ComponentRenderContext): void {
    this.ctx = ctx;
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const b = this.ctx.derived.hpBreakdown;
    const editState = this.ctx.editState;

    const title = this.contentEl.createDiv({ cls: "pc-maxhp-title" });
    title.createSpan({ text: "Max HP" });
    const dice = this.diceContext();
    if (dice) title.createSpan({ cls: "pc-maxhp-dice", text: dice });

    const overridden = b.override != null;
    this.contentEl.createDiv({ cls: "pc-maxhp-big", text: String(b.final) });
    const eq = this.contentEl.createDiv({
      cls: `pc-maxhp-eq${overridden ? " is-greyed" : ""}`,
    });
    this.renderEquation(eq, b);

    const strip = this.contentEl.createDiv({ cls: "pc-maxhp-fields" });
    if (!editState) return;
    this.renderRolledField(strip, b, editState);
    this.renderModifierField(strip, b, editState);
    this.renderOverrideField(strip, b, editState);
  }

  /** "d10 · 11 levels" for one class; "d10 ×11 · d8 ×3" multiclass; null when none. */
  private diceContext(): string | null {
    const valid = this.ctx.resolved.classes.filter(
      (c) => c.entity && parseDieSize(c.entity.hit_die) != null && c.level >= 1,
    );
    if (valid.length === 0) return null;
    if (valid.length === 1) return `${valid[0].entity!.hit_die} · ${valid[0].level} levels`;
    return valid.map((c) => `${c.entity!.hit_die} ×${c.level}`).join(" · ");
  }

  private renderEquation(host: HTMLElement, b: HPBreakdown): void {
    const term = (text: string) => host.createSpan({ cls: "pc-maxhp-term", text });
    term(`${b.diceSum} ${b.diceSource}`);
    if (b.conLevels > 0) {
      const sign = b.conMod * b.conLevels >= 0 ? "+" : "−";
      term(` ${sign} ${Math.abs(b.conMod * b.conLevels)} CON (${b.conMod >= 0 ? "+" : ""}${b.conMod} × ${b.conLevels})`);
    }
    for (const t of b.perLevelTerms) {
      const sign = t.total >= 0 ? "+" : "−";
      term(` ${sign} ${Math.abs(t.total)} ${t.label}`);
    }
    if (b.modifier != null) {
      const neg = b.modifier < 0;
      const span = host.createSpan({
        cls: `pc-maxhp-term${neg ? " is-negative" : ""}`,
        text: ` ${neg ? "−" : "+"} ${Math.abs(b.modifier)} modifier`,
      });
      void span;
    }
    if (b.exhaustionMultiplier < 1) {
      term(` × ${b.exhaustionMultiplier} (exhaustion ${b.exhaustionLevel})`);
    }
  }

  private renderRolledField(strip: HTMLElement, b: HPBreakdown, es: CharacterEditState): void {
    const set = b.diceSource === "rolled";
    this.field(strip, {
      label: "Rolled dice sum",
      value: set ? String(b.diceSum) : String(b.averageDiceSum),
      placeholder: !set,
      hint: `average: ${b.averageDiceSum}`,
      min: 1,
      onCommit: (n) => es.setRolledHp(n),
      onClear: set ? () => es.clearRolledHp() : null,
      commitInitial: set ? b.diceSum : b.averageDiceSum,
    });
  }

  private renderModifierField(strip: HTMLElement, b: HPBreakdown, es: CharacterEditState): void {
    const set = b.modifier != null;
    this.field(strip, {
      label: "Modifier",
      value: set ? `${b.modifier! > 0 ? "+" : ""}${b.modifier}` : "+0",
      negative: set && b.modifier! < 0,
      placeholder: !set,
      hint: "in-game effect, ±N",
      onCommit: (n) => es.setHpModifier(n),
      onClear: set ? () => es.clearHpModifier() : null,
      commitInitial: set ? b.modifier! : 0,
    });
  }

  private renderOverrideField(strip: HTMLElement, b: HPBreakdown, es: CharacterEditState): void {
    const set = b.override != null;
    this.field(strip, {
      label: "Override",
      value: set ? String(b.override) : "none",
      placeholder: !set,
      hint: "replaces everything",
      min: 1,
      onCommit: (n) => es.setMaxHpOverride(n),
      onClear: set ? () => es.clearMaxHpOverride() : null,
      commitInitial: set ? b.override! : b.final,
    });
  }

  private field(strip: HTMLElement, opts: {
    label: string; value: string; hint: string;
    placeholder?: boolean; negative?: boolean; min?: number;
    onCommit: (n: number) => void; onClear: (() => void) | null;
    commitInitial: number;
  }): void {
    const field = strip.createDiv({ cls: "pc-maxhp-field" });
    field.createDiv({ cls: "pc-maxhp-field-lbl", text: opts.label });
    const valWrap = field.createDiv({ cls: "pc-maxhp-field-val" });
    const box = valWrap.createSpan({
      cls: `pc-maxhp-box${opts.placeholder ? " is-placeholder" : ""}${opts.negative ? " is-negative" : ""}`,
      text: opts.value,
    });
    box.addEventListener("click", () => {
      makeInlineInput(box, {
        initial: opts.commitInitial,
        min: opts.min,
        onCommit: (n) => opts.onCommit(n),
        onCancel: () => this.render(),
      });
    });
    if (opts.onClear) {
      const mark = valWrap.createSpan({
        cls: "archivist-override-mark",
        text: "*",
        attr: { title: "Clear · back to automatic" },
      });
      mark.addEventListener("click", (e) => { e.stopPropagation(); opts.onClear!(); });
    }
    field.createDiv({ cls: "pc-maxhp-field-hint", text: opts.hint });
  }
}
