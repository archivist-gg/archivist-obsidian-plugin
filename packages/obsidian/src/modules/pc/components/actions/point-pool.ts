import { numberField } from "../edit-primitives";

export interface PointPoolOpts {
  id: string;
  name: string;
  used: number;
  max: number;
  /** Already a caption (the caller builds it from RESET_LABELS). */
  resetLabel?: string;
  /** Optional `title` for that caption: the `custom` recovery tooltip `renderChargeBoxes` renders
   *  through `recoveryTitle`, so a resource that reaches the numeric widget instead of the boxes
   *  keeps it (R4-G4 T3 review M-5, taken at T5). */
  resetTitle?: string;
  /** Receives the new USED count, clamped to [0, max] here; the edit-state clamps again. */
  onSet: (newUsed: number) => void;
}

/** The numeric pool widget (R4-G4 §5.2.1): "remaining / max <name>" with − / + steppers and a direct-entry
 *  field on the value. Measured 2026-09-05 with `grep -rn "renderPointPool(" packages/obsidian/src`:
 *  FIVE call expressions besides this declaration, living in FOUR calling functions. The two feature
 *  sites `renderCardResource` and `renderFirstResourceTracker` (`components/actions/feature-rows.ts`)
 *  and T7b's `renderPickTracker` (`components/actions/pick-tracker.ts`, the pool row / granted row /
 *  boon row tracker of a pick's own `uses`) each hand it in as `renderLarge` for a max above
 *  CHARGE_BOX_LIMIT; T5's `renderPoolHead` (`components/pool-tab.ts`) both calls it directly for a
 *  `point-pool` tab head and hands it in as `renderLarge` for a `dice-pool` one, which is why the
 *  expressions outnumber the functions by one. */
export function renderPointPool(host: HTMLElement, opts: PointPoolOpts): HTMLElement {
  const wrap = host.createDiv({ cls: "pc-point-pool" });
  const clamp = (n: number) => Math.max(0, Math.min(opts.max, Math.floor(n)));
  const remaining = () => opts.max - opts.used;
  const minus = wrap.createEl("button", { cls: "pc-point-pool-minus", text: "−", attr: { "aria-label": `Spend 1 ${opts.name}` } });
  const value = wrap.createSpan({ cls: "pc-point-pool-value", text: `${remaining()} / ${opts.max}` });
  const plus = wrap.createEl("button", { cls: "pc-point-pool-plus", text: "+", attr: { "aria-label": `Restore 1 ${opts.name}` } });
  wrap.createSpan({ cls: "pc-point-pool-name", text: opts.name });
  if (opts.resetLabel) {
    const cap = wrap.createSpan({ cls: "pc-point-pool-reset", text: opts.resetLabel });
    if (opts.resetTitle) cap.setAttribute("title", opts.resetTitle);
  }
  minus.addEventListener("click", (e) => { e.stopPropagation(); opts.onSet(clamp(opts.used + 1)); });
  plus.addEventListener("click", (e) => { e.stopPropagation(); opts.onSet(clamp(opts.used - 1)); });
  // Direct entry edits the REMAINING count; used = max − remaining.
  numberField(value, { getValue: remaining, onSet: (v) => opts.onSet(clamp(opts.max - v)), min: 0, max: opts.max });
  return wrap;
}
