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
 *  field on the value. RE-MEASURED 2026-09-07, after R4-G5 §4.3.2 folded the four tracker tails into one
 *  helper, with `grep -rn "renderPointPool(" packages/obsidian/src` (four hits: this declaration, the
 *  grep recipe spelled inside this docblock, and two call expressions): TWO call expressions besides
 *  this declaration, living in TWO calling functions. `renderResourceTracker`
 *  (`components/actions/resource-tracker.ts`) hands it
 *  in as `renderLarge` for a max above CHARGE_BOX_LIMIT, once for all four tracker sites it serves
 *  (`renderCardResource` and `renderFirstResourceTracker` in `components/actions/feature-rows.ts`,
 *  `renderPickTracker` in `components/actions/pick-tracker.ts`, and `renderPoolHead`'s dice shape);
 *  `renderPoolHead` (`components/pool-tab.ts`) still calls it DIRECTLY for a `point-pool` tab head,
 *  which is the one path that never goes through the helper. */
export function renderPointPool(host: HTMLElement, opts: PointPoolOpts): HTMLElement {
  const wrap = host.createDiv({ cls: "pc-point-pool" });
  const clamp = (n: number) => Math.max(0, Math.min(opts.max, Math.floor(n)));
  const remaining = () => opts.max - opts.used;
  const minus = wrap.createEl("button", { cls: "pc-point-pool-minus", text: "−", attr: { "aria-label": `Spend 1 ${opts.name}` } });
  const value = wrap.createSpan({ cls: "pc-point-pool-value", text: `${remaining()} / ${opts.max}` });
  const plus = wrap.createEl("button", { cls: "pc-point-pool-plus", text: "+", attr: { "aria-label": `Restore 1 ${opts.name}` } });
  wrap.createSpan({ cls: "pc-point-pool-name", text: opts.name });
  // The reset caption carries its own separator (R4 {G5, G6} live rider V-7): the widget writes the
  // resource name immediately before it and `createSpan` inserts no punctuation, so the live run read
  // `2 / 2  Sorcery Point Long Rest` on the Metamagic head, the two captions divided by nothing but
  // the flex gap. The `·` is the arc's separator and rides INSIDE the caption span, so the two words
  // and the mark stay one unbreakable part when the head wraps.
  if (opts.resetLabel) {
    const cap = wrap.createSpan({ cls: "pc-point-pool-reset", text: `· ${opts.resetLabel}` });
    if (opts.resetTitle) cap.setAttribute("title", opts.resetTitle);
  }
  minus.addEventListener("click", (e) => { e.stopPropagation(); opts.onSet(clamp(opts.used + 1)); });
  plus.addEventListener("click", (e) => { e.stopPropagation(); opts.onSet(clamp(opts.used - 1)); });
  // Direct entry edits the REMAINING count; used = max − remaining.
  numberField(value, { getValue: remaining, onSet: (v) => opts.onSet(clamp(opts.max - v)), min: 0, max: opts.max });
  return wrap;
}
