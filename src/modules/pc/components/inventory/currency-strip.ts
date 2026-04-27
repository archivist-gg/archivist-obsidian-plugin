import type { SheetComponent, ComponentRenderContext } from "../component.types";
import { makeInlineInput } from "../edit-primitives";

const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"] as const;

export class CurrencyStrip implements SheetComponent {
  readonly type = "currency-strip";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const cur = ctx.resolved.definition.currency;
    const editState = ctx.editState;
    const strip = el.createDiv({ cls: "pc-currency-row" });

    for (const coin of COIN_KEYS) {
      const value = cur?.[coin] ?? 0;
      const cell = strip.createDiv({ cls: "pc-currency-cell" });

      cell.createDiv({ cls: `pc-currency-denom coin-${coin}`, text: coin.toUpperCase() });

      const valEl = cell.createDiv({ cls: "pc-currency-val", text: String(value) });

      if (editState) {
        valEl.classList.add("pc-edit-click");
        valEl.addEventListener("click", () => {
          makeInlineInput(valEl, {
            initial: value,
            min: 0,
            max: 999_999,
            onCommit: (n) => editState.setCurrency(coin, n),
            onCancel: () => { /* rerender restores valEl */ },
          });
        });
      }
    }
  }
}
