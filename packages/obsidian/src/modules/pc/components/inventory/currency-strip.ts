import type { SheetComponent, ComponentRenderContext } from "../component.types";
import { numberField } from "../edit-primitives";
import { COIN_KEYS, MAX_COIN } from "../../pc.coin-math";
import { openCoinModal, refreshCoinModal } from "../coin-modal";

export interface CurrencyStripOptions {
  /** "inline" (default; builder equipment step) keeps per-value numberField
   *  editing with all five cells. "modal" (sheet inventory header) makes the
   *  whole row one click target that opens the coin modal, drops inline
   *  editing, and hides the EP cell at 0. */
  interaction?: "inline" | "modal";
}

export class CurrencyStrip implements SheetComponent {
  readonly type = "currency-strip";

  constructor(private options: CurrencyStripOptions = {}) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const modal = this.options.interaction === "modal";
    // Modal mode only: keep an open coin modal in sync with every sheet
    // render. ALL tab panels render on every sheet pass (TabsContainer
    // renders each panel; setActive only toggles a CSS class), so this fires
    // for every editState mutation even when Inventory is not the visible
    // tab — a future lazy-tab-render refactor would silently break coin
    // (and Max-HP) modal refresh. Inline (builder) renders never touch the
    // modal; builder safety comes from the builder-entry closeCoinModal()
    // in pc.sheet.ts.
    if (modal) refreshCoinModal(ctx);

    const cur = ctx.resolved.definition.currency;
    const editState = ctx.editState;
    const clickable = modal && !!editState;
    const strip = el.createDiv({
      cls: `pc-currency-row${clickable ? " pc-currency-clickable" : ""}`,
    });
    if (clickable) strip.addEventListener("click", () => openCoinModal(ctx));

    for (const coin of COIN_KEYS) {
      const value = cur?.[coin] ?? 0;
      // Modal mode hides electrum at 0 (the modal itself always lists all
      // five, so EP stays reachable); inline/builder mode keeps all five —
      // the builder has no modal fallback for adding electrum.
      if (modal && coin === "ep" && value === 0) continue;

      const cell = strip.createDiv({ cls: "pc-currency-cell" });
      cell.createDiv({ cls: `pc-currency-denom coin-${coin}`, text: coin.toUpperCase() });
      const valEl = cell.createDiv({ cls: "pc-currency-val", text: String(value) });

      if (!modal && editState) {
        numberField(valEl, {
          getValue: () => value,
          onSet: (n) => editState.setCurrency(coin, n),
          min: 0,
          max: MAX_COIN,
        });
      }
    }
  }
}
