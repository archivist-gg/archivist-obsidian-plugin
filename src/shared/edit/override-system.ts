/**
 * Click-to-edit override pattern used throughout auto-calculated stat
 * displays (HP, saves, skills, etc). Wires a value element + label pair
 * so clicking the value opens a numeric input, committing sets the
 * override via `onSet`, and clicking the resulting `*` mark clears it
 * via `onClear`.
 *
 * Generic: the caller supplies the auto-value getter, set/clear
 * callbacks, and an optional formatter; this helper does not know the
 * shape of any edit-state beyond "a number".
 */
export function wireOverride(
  valueEl: HTMLElement,
  autoLabel: HTMLElement,
  _field: string,
  getAutoValue: () => number,
  onSet: (val: number) => void,
  onClear: () => void,
  fmt: (val: number) => string = String,
  isAlreadyOverridden = false,
): void {
  let overrideInput: HTMLInputElement | null = null;
  let overrideMark: HTMLElement | null = null;

  function createOverrideMark(): HTMLElement {
    const mark = valueEl.doc.createElement("span");
    mark.className = "archivist-override-mark";
    mark.textContent = "*";
    mark.title = "Overridden -- click to restore auto-calculation";
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      onClear();
      if (overrideMark) { overrideMark.remove(); overrideMark = null; }
      autoLabel.textContent = "(Auto)";
    });
    return mark;
  }

  // If already overridden on initial render, show the asterisk mark immediately
  if (isAlreadyOverridden) {
    overrideMark = createOverrideMark();
    valueEl.after(overrideMark);
  }

  valueEl.addEventListener("click", () => {
    if (overrideInput) return; // already open

    const currentVal = parseInt(valueEl.textContent ?? "0") || 0;
    overrideInput = valueEl.doc.createElement("input");
    overrideInput.type = "number";
    overrideInput.value = String(currentVal);
    overrideInput.className = "archivist-num-in archivist-override-input";

    valueEl.textContent = "";
    valueEl.appendChild(overrideInput);
    autoLabel.textContent = "";
    overrideInput.focus();
    overrideInput.select();

    const commit = () => {
      const val = parseInt(overrideInput?.value ?? "") || getAutoValue();
      if (overrideInput) {
        overrideInput.remove();
        overrideInput = null;
      }
      valueEl.textContent = fmt(val);

      // Only mark as overridden if value differs from auto
      if (val !== getAutoValue()) {
        onSet(val);
        if (!overrideMark) {
          overrideMark = createOverrideMark();
        }
        valueEl.after(overrideMark);
      } else {
        autoLabel.textContent = "(Auto)";
      }
    };

    overrideInput.addEventListener("blur", commit);
    overrideInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") {
        if (overrideInput) { overrideInput.remove(); overrideInput = null; }
        valueEl.textContent = fmt(getAutoValue());
        autoLabel.textContent = "(Auto)";
      }
    });
  });
}
