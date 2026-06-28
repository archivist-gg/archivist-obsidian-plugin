export interface ChargeBoxesOpts {
  used: number;
  max: number;
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
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
}

const RESET_LABEL: Record<"dawn" | "short" | "long" | "special", string> = {
  "dawn":    "Dawn",
  "short":   "Short Rest",
  "long":    "Long Rest",
  "special": "Special",
};

const CHECKED = "archivist-toggle-box-checked";

export function renderChargeBoxes(parent: HTMLElement, opts: ChargeBoxesOpts): HTMLElement {
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
    wrap.createDiv({ cls: "pc-charge-recovery", text: `/ ${label}` });
  }
  return wrap;
}

function formatRecovery(rec: { amount: string; reset: "dawn" | "short" | "long" | "special" }): string {
  const base = RESET_LABEL[rec.reset];
  if (rec.reset === "dawn" && rec.amount && rec.amount !== "1") {
    return `${base} ${rec.amount}`;
  }
  return base;
}
