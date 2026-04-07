// src/edit/compendium-picker.ts

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
  // Remove any existing picker
  anchor.querySelector(".archivist-compendium-picker")?.remove();

  const picker = document.createElement("div");
  picker.className = "archivist-compendium-picker";

  for (const comp of compendiums) {
    const option = document.createElement("div");
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
    document.removeEventListener("click", onOutsideClick, true);
  }

  setTimeout(() => {
    document.addEventListener("click", onOutsideClick, true);
  }, 0);
}
