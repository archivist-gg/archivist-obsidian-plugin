export interface ExpandState {
  is(key: string): boolean;
  toggle(key: string): void;
  keys(): string[];
}

export function createExpandState(initial: string[] = []): ExpandState {
  const set = new Set<string>(initial);
  return {
    is: (k) => set.has(k),
    toggle: (k) => { if (set.has(k)) set.delete(k); else set.add(k); },
    keys: () => [...set],
  };
}

/** Adds a caret element and a click handler that fires `onChange(key)`. */
export function attachExpandToggle(row: HTMLElement, key: string, onChange: (key: string) => void): void {
  const caret = row.createSpan({ cls: "pc-action-caret", text: "▶" });
  caret.setAttribute("data-key", key);
  row.addEventListener("click", () => onChange(key));
}
