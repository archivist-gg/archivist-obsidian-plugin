import { setIcon } from "obsidian";

/**
 * Expandable section with a chevron-prefixed header. Clicking the
 * header toggles the `archivist-hidden` class on the body grid and the
 * `open` class on the chevron. Returns both elements so callers can
 * populate the grid and attach per-section decorations (e.g.,
 * class names like `archivist-saves-grid`).
 */
export function createCollapsible(
  parent: HTMLElement,
  title: string,
  startOpen: boolean,
): { header: HTMLElement; grid: HTMLElement } {
  const headerEl = parent.createDiv({ cls: "archivist-coll-header" });
  const chevron = headerEl.createEl("span", { cls: `archivist-coll-chevron${startOpen ? " open" : ""}` });
  setIcon(chevron, "chevron-right");
  headerEl.createEl("h4", { text: title });

  const grid = parent.createDiv();
  if (!startOpen) grid.addClass("archivist-hidden");

  headerEl.addEventListener("click", () => {
    const isOpen = chevron.hasClass("open");
    if (isOpen) {
      chevron.removeClass("open");
      grid.addClass("archivist-hidden");
    } else {
      chevron.addClass("open");
      grid.removeClass("archivist-hidden");
    }
  });

  return { header: headerEl, grid };
}
