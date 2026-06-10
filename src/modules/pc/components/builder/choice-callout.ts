export interface ChoiceCalloutOptions {
  label: string;
  choose: number;
  /** `inert` chips render with the `.inert` class and never fire onToggle —
   *  for visible-but-unselectable options (e.g. a slug with no resolved entity). */
  options: { value: string; label: string; inert?: boolean }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  /** Shows the amber "!" while nothing is chosen. The flag lives on the
   *  callout itself, never on the step rail or footer (parent spec §7). */
  required?: boolean;
}

/** Canonical toggle semantics shared by every call-site: under the limit
 *  toggle membership; at the limit choose-1 swaps, choose-N refuses. The
 *  caller owns the Set and re-renders after applying. */
export function applyChoiceToggle(selected: Set<string>, value: string, choose: number): void {
  if (selected.has(value)) {
    selected.delete(value);
    return;
  }
  if (selected.size >= choose) {
    if (choose !== 1) return;
    selected.clear();
  }
  selected.add(value);
}

/** N1 treatment (parent spec §8): borderless callout — serif-bold label over
 *  a hairline tan rule with a muted "Choose N" badge; ink-outlined chips,
 *  crimson + ✓ when selected. Pure presentational: clicking a clickable chip
 *  fires onToggle; the caller mutates state (applyChoiceToggle) and redraws. */
export function renderChoiceCallout(parent: HTMLElement, opts: ChoiceCalloutOptions): void {
  const box = parent.createDiv({ cls: "pc-bchoice" });
  const head = box.createDiv({ cls: "pc-bchoice-head" });
  head.createSpan({ cls: "pc-bchoice-label", text: opts.label });
  head.createSpan({ cls: "pc-bchoice-badge", text: `Choose ${opts.choose}` });
  if (opts.required && opts.selected.size === 0) {
    head.createSpan({ cls: "pc-bchoice-flag", text: "!", attr: { title: "Required choice" } });
  }
  const atLimit = opts.selected.size >= opts.choose;
  const chips = box.createDiv({ cls: "pc-bchoice-chips" });
  for (const o of opts.options) {
    const sel = opts.selected.has(o.value);
    // choose-1 never mutes: picking another chip is a swap request.
    const muted = !sel && atLimit && opts.choose !== 1;
    const chip = chips.createSpan({
      cls: `pc-bchoice-chip${sel ? " sel" : ""}${muted ? " muted" : ""}${o.inert ? " inert" : ""}`,
      text: sel ? `✓ ${o.label}` : o.label,
    });
    // Inert chips are visible-but-unselectable: no click listener at all.
    if (!o.inert && !muted) chip.addEventListener("click", () => opts.onToggle(o.value));
  }
}
