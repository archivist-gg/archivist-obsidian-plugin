/**
 * Shared click-to-edit primitives for PC-sheet numeric fields.
 *
 * `makeInlineInput` is the DOM-dance helper: it replaces a value element
 * with an inline `<input type="number">`, handles commit/cancel via
 * Enter/Escape/blur, and stops keyboard event propagation so Obsidian's
 * TextFileView hotkey manager can't swallow digits at a higher capture
 * phase. Callers pass an `initial` number and `{ onCommit, onCancel }`;
 * this helper does not know about character state.
 *
 * `numberField` wraps a value element with click-to-edit behavior driven
 * by a `getValue` / `onSet` pair. Used for direct state fields with no
 * baseline (Temp HP, Current HP).
 *
 * `numberOverride` wraps a value element with click-to-edit AND appends
 * a crimson `*` (.archivist-override-mark) when `isOverridden()` returns
 * true; clicking the mark calls `onClear()`. Used for overridable fields
 * (Max HP, AC, ability scores).
 */

export interface InlineInputOpts {
  initial: number;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
  onCancel: () => void;
}

export function makeInlineInput(valueEl: HTMLElement, opts: InlineInputOpts): void {
  const doc = valueEl.ownerDocument ?? document;
  const parent = valueEl.parentElement;
  if (!parent) return;

  const input = doc.createElement("input");
  input.type = "number";
  // Preserve valueEl's classes so layout-affecting CSS (flex order,
  // min-width, text-align, font weight, etc.) continues to apply to the
  // input. Without this, e.g. .pc-skill-bonus { order: 2 } is lost and
  // the input falls into the wrong visual slot. See Bug A.
  input.className = `pc-edit-inline ${valueEl.className}`.trim();
  input.value = String(opts.initial);
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);

  parent.insertBefore(input, valueEl);
  valueEl.remove();
  input.focus();
  input.select();

  let done = false;

  const clamp = (n: number) => {
    if (opts.min !== undefined) n = Math.max(opts.min, n);
    if (opts.max !== undefined) n = Math.min(opts.max, n);
    return n;
  };

  const commit = () => {
    if (done) return;
    done = true;
    const parsed = parseInt(input.value, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed) : opts.initial;
    opts.onCommit(next);
  };

  const cancel = () => {
    if (done) return;
    done = true;
    // Restore the original value element in place of the input. We hold
    // a reference to valueEl (it's still in memory, just detached from
    // the DOM after valueEl.remove() during input setup), so re-inserting
    // it preserves all event listeners that numberOverride/numberField
    // attached. See Bug C.
    parent.insertBefore(valueEl, input);
    input.remove();
    opts.onCancel();
  };

  const stopProp = (e: Event) => e.stopPropagation();

  input.addEventListener("keydown", (e) => {
    stopProp(e);
    if (e.key === "Enter") { e.preventDefault(); commit(); return; }
    if (e.key === "Escape") { e.preventDefault(); cancel(); return; }
  });
  input.addEventListener("keyup", stopProp);
  input.addEventListener("keypress", stopProp);
  input.addEventListener("blur", () => { if (!done) commit(); });
}

export interface NumberFieldOpts {
  getValue: () => number;
  onSet: (value: number) => void;
  min?: number;
  max?: number;
}

export function numberField(valueEl: HTMLElement, opts: NumberFieldOpts): void {
  valueEl.classList.add("pc-edit-click");
  valueEl.addEventListener("click", () => {
    makeInlineInput(valueEl, {
      initial: opts.getValue(),
      min: opts.min,
      max: opts.max,
      onCommit: opts.onSet,
      onCancel: () => { /* onChange() rerender will restore valueEl */ },
    });
  });
}

export interface NumberOverrideOpts {
  getEffective: () => number;
  isOverridden: () => boolean;
  onSet: (value: number) => void;
  onClear: () => void;
  min?: number;
  max?: number;
}

export function numberOverride(valueEl: HTMLElement, opts: NumberOverrideOpts): void {
  valueEl.classList.add("pc-edit-click");
  valueEl.addEventListener("click", () => {
    makeInlineInput(valueEl, {
      initial: opts.getEffective(),
      min: opts.min,
      max: opts.max,
      onCommit: opts.onSet,
      onCancel: () => { /* onChange() rerender will restore valueEl */ },
    });
  });

  if (opts.isOverridden()) {
    const mark = (valueEl.ownerDocument ?? document).createElement("span");
    mark.className = "archivist-override-mark";
    mark.textContent = "*";
    mark.title = "Manual override — click to remove and use the auto-calculated value";
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      const win = (valueEl.ownerDocument ?? document).defaultView ?? window;
      if (win.confirm("Clear this manual override and revert to the auto-calculated value?")) {
        opts.onClear();
      }
    });
    valueEl.appendChild(mark);
  }
}

export interface CurrencyCellOpts {
  coin: string;
  value: number;
  onSet: (n: number) => void;
}

export function currencyCell(parent: HTMLElement, opts: CurrencyCellOpts): HTMLElement {
  const cell = parent.createDiv({ cls: "pc-currency-cell" });
  const valEl = cell.createDiv({ cls: "pc-currency-val", text: String(opts.value) });
  cell.createDiv({ cls: "pc-currency-label", text: opts.coin });
  valEl.addEventListener("click", () => {
    makeInlineInput(valEl, {
      initial: opts.value, min: 0, max: 999_999,
      onCommit: (n) => opts.onSet(n),
      onCancel: () => {},
    });
  });
  return cell;
}
