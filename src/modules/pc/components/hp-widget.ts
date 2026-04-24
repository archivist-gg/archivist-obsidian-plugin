import type { SheetComponent, ComponentRenderContext } from "./component.types";

/**
 * HP widget in the hero right. DOM scaffold only in SP3:
 * HEAL button / number input / DAMAGE button on the left;
 * CURRENT / MAX / TEMP three-up with HIT POINTS label below on the right.
 * SP4 will wire the handlers.
 */
export class HpWidget implements SheetComponent {
  readonly type = "hp-widget";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const wrap = el.createDiv({ cls: "pc-panel pc-hp-widget" });

    // Visual mode class + label
    const ds = ctx.resolved?.state?.death_saves;
    let labelText = "HIT POINTS";
    if (ctx.derived.hp.current === 0) {
      if (ds && ds.failures >= 3) {
        wrap.addClass("dead");
        labelText = "DEAD";
      } else {
        wrap.addClass("unconscious");
        labelText = "UNCONSCIOUS";
      }
    }

    const actions = wrap.createDiv({ cls: "pc-hp-actions" });
    const healBtn = actions.createEl("button", { cls: "pc-hp-heal", text: "HEAL" });
    const input = actions.createEl("input", {
      cls: "pc-hp-input",
      attr: { type: "number", placeholder: "0" },
    });
    const dmgBtn = actions.createEl("button", { cls: "pc-hp-damage", text: "DAMAGE" });

    const body = wrap.createDiv({ cls: "pc-hp-body" });
    const nums = body.createDiv({ cls: "pc-hp-nums" });
    this.col(nums, "pc-hp-current", "CURRENT", String(ctx.derived.hp.current));
    this.col(nums, "pc-hp-max", "MAX", String(ctx.derived.hp.max));
    this.col(nums, "pc-hp-temp", "TEMP", ctx.derived.hp.temp > 0 ? String(ctx.derived.hp.temp) : "—");
    body.createDiv({ cls: "pc-hp-label", text: labelText });

    // Interactivity
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
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const n = readInput();
      if (!n) return;
      editState.heal(n);
      input.value = "";
    });
  }

  private col(parent: HTMLElement, cls: string, label: string, value: string) {
    const col = parent.createDiv({ cls: `pc-hp-col ${cls}` });
    col.createDiv({ cls: "pc-hp-lbl", text: label });
    col.createDiv({ cls: "pc-hp-val", text: value });
  }
}
