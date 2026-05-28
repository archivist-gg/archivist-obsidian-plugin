/**
 * Custom up/down spinner buttons for a number input.
 *
 * Creates a two-button column (`▲` / `▼`) inside the given wrapper that
 * increments/decrements the given input's numeric value and re-fires an
 * `input` event so existing listeners re-run. Click handlers call
 * `preventDefault`/`stopPropagation` so the click doesn't bubble to
 * parent edit-mode UIs.
 */
export function createSpinButtons(wrap: HTMLElement, input: HTMLInputElement): void {
  const spinDiv = wrap.createDiv({ cls: "archivist-num-spin" });

  const upBtn = spinDiv.createEl("button");
  upBtn.textContent = "▲"; // triangle up
  upBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = String((parseInt(input.value) || 0) + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const downBtn = spinDiv.createEl("button");
  downBtn.textContent = "▼"; // triangle down
  downBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = String((parseInt(input.value) || 0) - 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
