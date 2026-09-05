/** A PRESENTATIONAL constant (renderer-side, not game vocabulary: Gate 0 Q3): above this many points
 *  the feature sites switch to the numeric widget. The spell-slot site (`renderCastView`) and the item
 *  site (`renderItemRow`) call `renderChargeBoxes` directly, pass none of `limit` / `atWill` /
 *  `renderLarge`, and keep drawing boxes. The race block does NOT: it rides
 *  `renderFirstResourceTracker`, so it receives all three opts like any other feature tracker. That is
 *  harmless by the spec's measurement (R4-G4 §5.1: 228 race resource declarations, all `prof` or small
 *  literals, none 999, none above 12), so no race trait reaches either new branch today. */
export const CHARGE_BOX_LIMIT = 12;

export interface ChargeBoxesOpts {
  used: number;
  max: number;
  /**
   * The recovery caption under the boxes, in one of TWO shapes (R4-G3a §8.2 (viii)):
   *   - `{ amount, reset }` · the ITEM path. `reset` is the PERSISTED item-charge
   *     vocabulary (`pc.schema.ts` `equipmentEntryStateSchema.recovery.reset`),
   *     rendered through {@link RESET_LABEL} below. Untouched (invariant 4).
   *   - `{ amount, label }` · the FEATURE path. `label` is already a caption,
   *     built by the caller from `RESET_LABELS` (the `ResetTrigger`-keyed table
   *     in ./reset-labels), and is rendered verbatim.
   */
  recovery?:
    | { amount: string; reset: "dawn" | "short" | "long" | "special" }
    | { amount: string; label: string };
  /** Optional `title` for the recovery caption (the `custom` recovery tooltip). */
  recoveryTitle?: string;
  /**
   * Atomic per-click setter. Receives the new `used` count after applying
   * legendary-style click semantics:
   *   - clicking an unchecked box at index i → newUsed = i + 1
   *   - clicking a checked box → newUsed = currentUsed - 1
   * Prefer this over `onExpend`/`onRestore` for atomic updates.
   */
  onSet?: (newUsed: number) => void;
  /**
   * Backward-compat. Used only when `onSet` is not provided. The component
   * computes the delta and calls `onExpend`/`onRestore` `Math.abs(delta)` times.
   */
  onExpend?: () => void;
  onRestore?: () => void;
  /** Boxes above this count route to `renderLarge` (default CHARGE_BOX_LIMIT). */
  limit?: number;
  /** The `max === AT_WILL_MAX` case: render the text "at will" and no boxes. Checked FIRST. */
  atWill?: boolean;
  /** The fallback the caller supplies for `max > limit` (the feature sites pass renderPointPool). */
  renderLarge?: (parent: HTMLElement, opts: ChargeBoxesOpts) => HTMLElement;
}

const RESET_LABEL: Record<"dawn" | "short" | "long" | "special", string> = {
  "dawn":    "Dawn",
  "short":   "Short Rest",
  "long":    "Long Rest",
  "special": "Special",
};

const CHECKED = "archivist-toggle-box-checked";

export function renderChargeBoxes(parent: HTMLElement, opts: ChargeBoxesOpts): HTMLElement {
  if (opts.atWill) {
    const wrap = parent.createDiv({ cls: "pc-charge-boxes pc-charge-boxes-at-will" });
    wrap.createSpan({ cls: "pc-charge-at-will", text: "at will" });
    return wrap;
  }
  if (opts.renderLarge && opts.max > (opts.limit ?? CHARGE_BOX_LIMIT)) return opts.renderLarge(parent, opts);
  const wrap = parent.createDiv({ cls: "pc-charge-boxes" });
  const boxRow = wrap.createDiv({ cls: "archivist-toggle-box-row" });
  const boxes: HTMLElement[] = [];

  for (let i = 0; i < opts.max; i++) {
    const isChecked = i < opts.used;
    const box = boxRow.createDiv({ cls: "archivist-toggle-box" });
    if (isChecked) box.classList.add(CHECKED);
    boxes.push(box);
  }

  // Wire click handlers AFTER all boxes exist so we can compute current count.
  boxes.forEach((box, i) => {
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCheckedNow = box.classList.contains(CHECKED);
      const currentCount = boxes.filter((b) => b.classList.contains(CHECKED)).length;
      // Click checked → decrement count (consume from rightmost).
      // Click unchecked → fill from the left up to and including the clicked box.
      const newUsed = isCheckedNow ? currentCount - 1 : i + 1;
      // Update visual state immediately so the click feels responsive even
      // when the consumer's onChange triggers a full re-render.
      boxes.forEach((b, j) => {
        if (j < newUsed) b.classList.add(CHECKED);
        else b.classList.remove(CHECKED);
      });

      if (opts.onSet) {
        opts.onSet(newUsed);
        return;
      }
      // Backward-compat fallback: emit N expend/restore events.
      const diff = newUsed - currentCount;
      if (diff > 0) {
        for (let k = 0; k < diff; k++) opts.onExpend?.();
      } else if (diff < 0) {
        for (let k = 0; k < -diff; k++) opts.onRestore?.();
      }
    });
  });

  if (opts.recovery) {
    const label = formatRecovery(opts.recovery);
    const cap = wrap.createDiv({ cls: "pc-charge-recovery", text: `/ ${label}` });
    if (opts.recoveryTitle) cap.setAttribute("title", opts.recoveryTitle);
  }
  return wrap;
}

function formatRecovery(rec: NonNullable<ChargeBoxesOpts["recovery"]>): string {
  // The feature path hands over a finished caption; only the item path consults
  // the four-member map (and only it carries the dawn "N per dawn" suffix).
  if ("label" in rec) return rec.label;
  const base = RESET_LABEL[rec.reset];
  if (rec.reset === "dawn" && rec.amount && rec.amount !== "1") {
    return `${base} ${rec.amount}`;
  }
  return base;
}
