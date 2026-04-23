import type { SheetComponent, ComponentRenderContext } from "./component.types";

/**
 * Hit-Dice widget in the hero right. Single panel always — never stacked for
 * multiclass. When multiple die types exist, a chip row at the top switches
 * which die's counts are shown. + / − on the left. DOM scaffold only (SP4 wires).
 */
export class HitDiceWidget implements SheetComponent {
  readonly type = "hit-dice-widget";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const wrap = el.createDiv({ cls: "pc-panel pc-hd-widget" });
    const hd = ctx.resolved?.state?.hit_dice ?? {};
    const dies = Object.keys(hd).sort(
      (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")),
    );

    if (dies.length === 0) {
      wrap.createDiv({ cls: "pc-hd-empty", text: "—" });
      return;
    }

    const actions = wrap.createDiv({ cls: "pc-hd-actions" });
    actions.createEl("button", { cls: "pc-hd-plus", text: "+", attr: { title: "Restore hit die" } });
    actions.createEl("button", { cls: "pc-hd-minus", text: "−", attr: { title: "Spend hit die" } });

    const body = wrap.createDiv({ cls: "pc-hd-body" });

    if (dies.length > 1) {
      const chips = body.createDiv({ cls: "pc-hd-chips" });
      dies.forEach((die, i) => {
        chips.createSpan({
          cls: `pc-hd-chip${i === 0 ? " active" : ""}`,
          text: die,
          attr: { "data-die": die },
        });
      });
    }

    const active = dies[0];
    const { used, total } = hd[active];
    const remaining = total - used;
    const nums = body.createDiv({ cls: "pc-hd-nums" });
    nums.createSpan({ cls: "pc-hd-rem", text: String(remaining) });
    nums.createSpan({ cls: "pc-hd-sep", text: " / " });
    nums.createSpan({ cls: "pc-hd-tot", text: String(total) });

    body.createDiv({ cls: "pc-hd-label", text: `HIT DICE · ${active}` });
  }
}
