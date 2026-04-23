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

    const actions = wrap.createDiv({ cls: "pc-hp-actions" });
    actions.createEl("button", { cls: "pc-hp-heal", text: "HEAL" });
    actions.createEl("input", {
      cls: "pc-hp-input",
      attr: { type: "number", placeholder: "0" },
    });
    actions.createEl("button", { cls: "pc-hp-damage", text: "DAMAGE" });

    const body = wrap.createDiv({ cls: "pc-hp-body" });
    const nums = body.createDiv({ cls: "pc-hp-nums" });
    this.col(nums, "pc-hp-current", "CURRENT", String(ctx.derived.hp.current));
    this.col(nums, "pc-hp-max", "MAX", String(ctx.derived.hp.max));
    this.col(nums, "pc-hp-temp", "TEMP", ctx.derived.hp.temp > 0 ? String(ctx.derived.hp.temp) : "—");
    body.createDiv({ cls: "pc-hp-label", text: "HIT POINTS" });
  }

  private col(parent: HTMLElement, cls: string, label: string, value: string) {
    const col = parent.createDiv({ cls: `pc-hp-col ${cls}` });
    col.createDiv({ cls: "pc-hp-lbl", text: label });
    col.createDiv({ cls: "pc-hp-val", text: value });
  }
}
