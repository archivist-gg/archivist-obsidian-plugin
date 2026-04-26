import type { SheetComponent, ComponentRenderContext } from "../component.types";
import { currencyCell } from "../edit-primitives";

const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"] as const;
type CoinKey = typeof COIN_KEYS[number];

export class CurrencyStrip implements SheetComponent {
  readonly type = "currency-strip";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const cur = ctx.resolved.definition.currency;
    const editState = ctx.editState;
    const strip = el.createDiv({ cls: "pc-currency-row" });

    for (const coin of COIN_KEYS) {
      const value = cur?.[coin] ?? 0;
      if (editState) {
        const c: CoinKey = coin;
        currencyCell(strip, { coin: c.toUpperCase(), value, onSet: (n) => editState.setCurrency(c, n) });
      } else {
        const cell = strip.createDiv({ cls: "pc-currency-cell" });
        cell.createDiv({ cls: "pc-currency-val", text: String(value) });
        cell.createDiv({ cls: "pc-currency-label", text: coin.toUpperCase() });
      }
    }
  }
}
