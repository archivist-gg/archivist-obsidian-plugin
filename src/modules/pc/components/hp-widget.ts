import type { SheetComponent, ComponentRenderContext } from "./component.types";

/**
 * HP widget in the hero right.
 * - Normal mode (HP > 0): HEAL / input / DAMAGE on the left;
 *   CURRENT / MAX / TEMP three-up with HIT POINTS label below on the right.
 * - Unconscious mode (HP = 0, failures < 3): the body swaps to a
 *   DEATH SAVES panel — 3 success dots + 3 failure dots — with the
 *   "UNCONSCIOUS" label below. The HEAL/input/DAMAGE column is unchanged.
 * - Dead mode (HP = 0, failures = 3): same shape as unconscious, label
 *   becomes "DEAD". HEAL still clickable so a heal cascade can revive.
 */
export class HpWidget implements SheetComponent {
  readonly type = "hp-widget";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const wrap = el.createDiv({ cls: "pc-panel pc-hp-widget" });

    const ds = ctx.resolved?.state?.death_saves;
    const hpCurrent = ctx.derived.hp.current;
    const isUnconscious = hpCurrent === 0;
    const isDead = isUnconscious && !!ds && ds.failures >= 3;

    let labelText = "HIT POINTS";
    if (isDead) {
      wrap.addClass("dead");
      labelText = "DEAD";
    } else if (isUnconscious) {
      wrap.addClass("unconscious");
      labelText = "UNCONSCIOUS";
    }

    // Action column — always present, always wired the same way.
    const actions = wrap.createDiv({ cls: "pc-hp-actions" });
    const healBtn = actions.createEl("button", { cls: "pc-hp-heal", text: "HEAL" });
    const input = actions.createEl("input", {
      cls: "pc-hp-input",
      attr: { type: "number", placeholder: "0" },
    });
    const dmgBtn = actions.createEl("button", { cls: "pc-hp-damage", text: "DAMAGE" });

    // Body — mode-specific.
    const body = wrap.createDiv({ cls: "pc-hp-body" });

    if (isUnconscious) {
      // Death-saves panel takes over the body.
      body.createDiv({ cls: "pc-hp-death-header", text: "DEATH SAVES" });

      const dsState = ds ?? { successes: 0, failures: 0 };
      const successRow = body.createDiv({ cls: "pc-hp-ds-row" });
      for (let i = 0; i < 3; i++) {
        const dot = successRow.createSpan({
          cls: `pc-death-save-success${dsState.successes > i ? " filled" : ""}`,
        });
        if (ctx.editState) {
          dot.addEventListener("click", () => ctx.editState!.toggleDeathSaveSuccess(i as 0 | 1 | 2));
        }
      }
      const failureRow = body.createDiv({ cls: "pc-hp-ds-row" });
      for (let i = 0; i < 3; i++) {
        const dot = failureRow.createSpan({
          cls: `pc-death-save-failure${dsState.failures > i ? " filled" : ""}`,
        });
        if (ctx.editState) {
          dot.addEventListener("click", () => ctx.editState!.toggleDeathSaveFailure(i as 0 | 1 | 2));
        }
      }
    } else {
      // Normal body — the tiles + HIT POINTS label.
      const nums = body.createDiv({ cls: "pc-hp-nums" });
      this.col(nums, "pc-hp-current", "CURRENT", String(ctx.derived.hp.current));
      this.col(nums, "pc-hp-max", "MAX", String(ctx.derived.hp.max));
      this.col(nums, "pc-hp-temp", "TEMP", ctx.derived.hp.temp > 0 ? String(ctx.derived.hp.temp) : "—");
    }

    body.createDiv({ cls: "pc-hp-label", text: labelText });

    // Interactivity — same wiring regardless of mode.
    if (!ctx.editState) return;
    const editState = ctx.editState;
    const readInput = () => Math.max(0, parseInt(input.value || "0", 10));

    healBtn.addEventListener("click", () => {
      const n = readInput();
      if (!n) return;
      editState.heal(n);
      input.value = "";
    });
    dmgBtn.addEventListener("click", () => {
      const n = readInput();
      if (!n) return;
      editState.damage(n);
      input.value = "";
    });
    // Defensive: stop propagation so any document-level hotkey listener
    // (e.g. Obsidian's hotkey manager attached to the TextFileView
    // contentEl) cannot swallow the keystroke before the input processes
    // it. Without this, typing digits into the HP input produces nothing
    // because the event is intercepted at a higher capture phase.
    const stopProp = (e: KeyboardEvent) => e.stopPropagation();
    input.addEventListener("keydown", (e) => {
      stopProp(e);
      if (e.key !== "Enter") return;
      e.preventDefault();
      const n = readInput();
      if (!n) return;
      editState.heal(n);
      input.value = "";
    });
    input.addEventListener("keyup", stopProp);
    input.addEventListener("keypress", stopProp);
  }

  private col(parent: HTMLElement, cls: string, label: string, value: string) {
    const col = parent.createDiv({ cls: `pc-hp-col ${cls}` });
    col.createDiv({ cls: "pc-hp-lbl", text: label });
    col.createDiv({ cls: "pc-hp-val", text: value });
  }
}
