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

    const active = ctx.editState?.sessionState.activeHitDie ?? dies[0];
    if (ctx.editState && ctx.editState.sessionState.activeHitDie == null) {
      // idempotent init — first render of this session picks the lowest die
      ctx.editState.sessionState.activeHitDie = active;
    }

    const actions = wrap.createDiv({ cls: "pc-hd-actions" });
    const plusBtn = actions.createEl("button", {
      cls: "pc-hd-plus",
      text: "+",
      attr: { title: "Restore hit die" },
    });
    const minusBtn = actions.createEl("button", {
      cls: "pc-hd-minus",
      text: "−",
      attr: { title: "Spend hit die" },
    });

    const body = wrap.createDiv({ cls: "pc-hd-body" });

    if (dies.length > 1) {
      const chips = body.createDiv({ cls: "pc-hd-chips" });
      for (const die of dies) {
        const chip = chips.createSpan({
          cls: `pc-hd-chip${die === active ? " active" : ""}`,
          text: die,
          attr: { "data-die": die },
        });
        if (ctx.editState) {
          chip.addEventListener("click", () => ctx.editState!.setActiveHitDie(die));
        }
      }
    }

    const { used, total } = hd[active];
    const remaining = total - used;
    const nums = body.createDiv({ cls: "pc-hd-nums" });
    nums.createSpan({ cls: "pc-hd-rem", text: String(remaining) });
    nums.createSpan({ cls: "pc-hd-sep", text: " / " });
    nums.createSpan({ cls: "pc-hd-tot", text: String(total) });

    body.createDiv({ cls: "pc-hd-label", text: `HIT DICE · ${active}` });

    if (!ctx.editState) return;
    plusBtn.addEventListener("click", () => ctx.editState!.restoreHitDie(active));
    minusBtn.addEventListener("click", () => ctx.editState!.spendHitDie(active));
  }
}
