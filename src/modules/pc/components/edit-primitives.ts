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
  input.className = "pc-edit-inline";
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
