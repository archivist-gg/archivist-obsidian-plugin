/**
 * Inline dropdown for choosing which compendium to save to.
 * Anchored below a trigger element (e.g., the Save As New button).
 * Parchment-themed, auto-closes on outside click.
 */
export function showCompendiumPicker(
  anchor: HTMLElement,
  compendiums: { name: string }[],
  onSelect: (compendium: { name: string }) => void,
): void {
  const doc = anchor.doc;
  const win = anchor.win;
  // Remove any existing picker
  anchor.querySelector(".archivist-compendium-picker")?.remove();

  const picker = doc.createElement("div");
  picker.className = "archivist-compendium-picker";

  for (const comp of compendiums) {
    const option = doc.createElement("div");
    option.className = "archivist-compendium-picker-option";
    option.textContent = comp.name;
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      cleanup();
      onSelect(comp);
    });
    picker.appendChild(option);
  }

  anchor.appendChild(picker);

  // Close on outside click (next tick to avoid immediate close)
  const onOutsideClick = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      cleanup();
    }
  };

  function cleanup() {
    picker.remove();
    doc.removeEventListener("click", onOutsideClick, true);
  }

  win.setTimeout(() => {
    doc.addEventListener("click", onOutsideClick, true);
  }, 0);
}
