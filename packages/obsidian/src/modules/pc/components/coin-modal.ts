// src/modules/pc/components/coin-modal.ts
import { Modal, type App } from "obsidian";
import type { ComponentRenderContext } from "./component.types";
import type { CharacterEditState } from "../pc.edit-state";
import { makeInlineInput } from "./edit-primitives";
import {
  COIN_KEYS, COIN_META, MAX_COIN, totalCp, formatGpTotal, validateAdjust, assembleDeltas,
  type Coin, type CurrencyLike,
} from "../pc.coin-math";

let current: CoinModal | null = null;

/** Open the coin modal (no-op without editState, matching the Max-HP precedent). */
export function openCoinModal(ctx: ComponentRenderContext): void {
  if (!ctx.editState) return;
  // Close a stale modal bound to a DIFFERENT character before reusing/opening,
  // so a split-view click on sheet B never repaints sheet A's open modal.
  if (current && ctx.editState !== current.openedWith) current.close();
  if (current) { current.updateContext(ctx); return; }
  const modal = new CoinModal(ctx.app, ctx, ctx.editState);
  current = modal;
  modal.open();
}

/** Called from CurrencyStrip.render (modal mode) on every sheet render.
 *  Repaints the open modal from fresh ctx; CLOSES it when the editState
 *  identity changed (file switch). */
export function refreshCoinModal(ctx: ComponentRenderContext): void {
  if (!current) return;
  if (!ctx.editState || ctx.editState !== current.openedWith) { current.close(); return; }
  current.updateContext(ctx);
}

export function closeCoinModal(): void {
  current?.close();
}

/** pp diamond · gp circle · ep hexagon · sp triangle · cp square (approved mock). */
const COIN_SHAPES: Record<Coin, { tag: "rect" | "circle" | "polygon"; attrs: Record<string, string> }> = {
  pp: { tag: "rect", attrs: { x: "3.4", y: "3.4", width: "9.2", height: "9.2", rx: "1.6", transform: "rotate(45 8 8)" } },
  gp: { tag: "circle", attrs: { cx: "8", cy: "8", r: "6" } },
  ep: { tag: "polygon", attrs: { points: "8,1.9 13.3,5 13.3,11 8,14.1 2.7,11 2.7,5" } },
  sp: { tag: "polygon", attrs: { points: "8,2.6 13.8,13 2.2,13" } },
  cp: { tag: "rect", attrs: { x: "3", y: "3", width: "10", height: "10", rx: "2" } },
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** Filled coin-shape icon: 16px in ledger rows, 12px in adjust labels. */
function coinShapeSvg(doc: Document, coin: Coin, sizePx: number): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.classList.add("pc-coin-shape");
  svg.setAttribute("width", String(sizePx));
  svg.setAttribute("height", String(sizePx));
  svg.setAttribute("viewBox", "0 0 16 16");
  const spec = COIN_SHAPES[coin];
  const shape = doc.createElementNS(SVG_NS, spec.tag);
  for (const [k, v] of Object.entries(spec.attrs)) shape.setAttribute(k, v);
  shape.setAttribute("style", `fill: var(--pc-coin-${coin})`);
  shape.setAttribute("stroke", "rgba(253,241,220,.45)");
  shape.setAttribute("stroke-width", "1.1");
  svg.appendChild(shape);
  return svg;
}

class CoinModal extends Modal {
  private totalNumEl!: HTMLElement;
  private ledgerEl!: HTMLElement;
  private adjustInputs = new Map<Coin, HTMLInputElement>();

  constructor(
    app: App,
    private ctx: ComponentRenderContext,
    readonly openedWith: CharacterEditState,
  ) { super(app); }

  onOpen(): void {
    this.contentEl.addClass("archivist-modal", "pc-coin-modal");
    this.buildSkeleton();
    this.updateDynamic();
  }

  onClose(): void {
    this.contentEl.empty();
    if (current === this) current = null;
  }

  updateContext(ctx: ComponentRenderContext): void {
    this.ctx = ctx;
    this.updateDynamic();
  }

  /** Always read currency through the CURRENT ctx (swapped on every refresh),
   *  never a snapshot captured at open. */
  private currency(): CurrencyLike {
    return this.ctx.resolved.definition.currency;
  }

  /** Built ONCE. The adjust section is never rebuilt afterwards — that is
   *  what preserves typed amounts, focus, and error highlights across
   *  background repaints. */
  private buildSkeleton(): void {
    this.contentEl.createDiv({ cls: "pc-coin-title", text: "Currency" });
    const total = this.contentEl.createDiv({ cls: "pc-coin-total" });
    this.totalNumEl = total.createSpan({ cls: "pc-coin-total-num" });
    total.createSpan({ cls: "pc-coin-total-unit", text: "gp total" });
    this.ledgerEl = this.contentEl.createDiv({ cls: "pc-coin-ledger" });
    this.buildAdjustSection();
  }

  /** The ledger is REBUILT on every call — load-bearing: makeInlineInput
   *  detaches the value element and does NOT restore it on commit (it relies
   *  on a rerender, like Max-HP's full render()); the rebuild discards the
   *  leftover input. The adjust section is NEVER touched here. */
  private updateDynamic(): void {
    this.totalNumEl.setText(formatGpTotal(totalCp(this.currency())));
    this.ledgerEl.empty();
    for (const coin of COIN_KEYS) this.buildLedgerRow(coin);
  }

  private buildLedgerRow(coin: Coin): void {
    const cur = this.currency()?.[coin] ?? 0;
    const row = this.ledgerEl.createDiv({ cls: "pc-coin-lrow" });
    row.appendChild(coinShapeSvg(this.contentEl.ownerDocument, coin, 16));
    const main = row.createSpan({ cls: "pc-coin-lrow-main" });
    const name = main.createSpan({ cls: "pc-coin-lrow-name", text: COIN_META[coin].name });
    name.createSpan({ cls: "pc-coin-lrow-abbr", text: `(${coin})` });
    const hint = COIN_META[coin].hint;
    if (hint) main.createSpan({ cls: "pc-coin-lrow-hint", text: hint });
    const val = row.createSpan({ cls: "pc-coin-lrow-val", text: String(cur) });
    val.addEventListener("click", () => {
      makeInlineInput(val, {
        initial: cur,
        min: 0,
        max: MAX_COIN,
        onCommit: (n) => this.openedWith.setCurrency(coin, n),
        onCancel: () => this.updateDynamic(),
      });
    });
  }

  private buildAdjustSection(): void {
    const doc = this.contentEl.ownerDocument;
    const section = this.contentEl.createDiv({ cls: "pc-coin-adjust" });
    section.createDiv({ cls: "pc-coin-adjust-title", text: "Adjust coins" });
    const grid = section.createDiv({ cls: "pc-coin-adjust-grid" });
    for (const coin of COIN_KEYS) {
      const cell = grid.createDiv({ cls: "pc-coin-adjust-cell" });
      const lbl = cell.createSpan({ cls: "pc-coin-adjust-lbl" });
      lbl.appendChild(coinShapeSvg(doc, coin, 12));
      lbl.createSpan({ cls: `pc-currency-denom coin-${coin}`, text: coin.toUpperCase() });
      const input = doc.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.className = "pc-coin-adjust-input";
      cell.appendChild(input);
      this.adjustInputs.set(coin, input);

      const stopProp = (e: Event) => e.stopPropagation();
      input.addEventListener("keydown", (e) => {
        // stopPropagation keeps Obsidian's hotkey manager from swallowing
        // digits (hp-widget model) — but it ALSO blocks Obsidian's own
        // Escape-to-close from ever seeing the event, so BOTH keys are
        // handled locally here (makeInlineInput model); never rely on a
        // stopped event bubbling to Obsidian.
        stopProp(e);
        if (e.key === "Enter") { e.preventDefault(); this.applyAdjust(1); return; }
        if (e.key === "Escape") { e.preventDefault(); this.close(); return; }
      });
      input.addEventListener("keyup", stopProp);
      input.addEventListener("keypress", stopProp);
      input.addEventListener("input", () => {
        const stripped = input.value.replace(/\D+/g, "");
        if (input.value !== stripped) input.value = stripped;
        input.classList.remove("is-error");
      });
    }
    const btns = section.createDiv({ cls: "pc-coin-adjust-btns" });
    this.button(btns, "pc-coin-btn is-add", "+ Add", () => this.applyAdjust(1));
    this.button(btns, "pc-coin-btn is-sub", "− Subtract", () => this.applyAdjust(-1));
    this.button(btns, "pc-coin-btn is-clear", "× Clear", () => this.clearAdjust());
  }

  private button(host: HTMLElement, cls: string, label: string, onClick: () => void): void {
    const btn = host.createEl("button", { cls, text: label });
    btn.addEventListener("click", onClick);
  }

  /** sign +1 = Add, -1 = Subtract. Boxes that are empty or parse to 0 are
   *  ignored; if nothing yields a non-zero delta the whole operation is a
   *  complete no-op. Validation reads the CURRENT ctx currency at invocation
   *  time. On any offender: atomic reject — highlight, write NOTHING. */
  private applyAdjust(sign: 1 | -1): void {
    const raw: Partial<Record<Coin, string>> = {};
    for (const [coin, input] of this.adjustInputs) raw[coin] = input.value;
    const deltas = assembleDeltas(raw, sign);
    if (Object.keys(deltas).length === 0) return;
    const verdict = validateAdjust(this.currency(), deltas);
    if (!verdict.ok) {
      for (const coin of verdict.offending) this.adjustInputs.get(coin)?.classList.add("is-error");
      return;
    }
    this.openedWith.adjustCurrency(deltas);
    this.clearAdjust();
  }

  private clearAdjust(): void {
    for (const input of this.adjustInputs.values()) {
      input.value = "";
      input.classList.remove("is-error");
    }
  }
}
