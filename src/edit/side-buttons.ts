import { setIcon } from "obsidian";

export type SideButtonState = "default" | "editing" | "pending";

interface SideButtonConfig {
  state: SideButtonState;
  onEdit: () => void;
  onSave: () => void;
  onCompendium: () => void;
  onCancel: () => void;
  onColumnToggle: () => void;
  isColumnActive: boolean;
}

export function renderSideButtons(container: HTMLElement, config: SideButtonConfig): void {
  container.empty();
  container.addClass("archivist-side-btns");

  if (config.state === "pending") {
    // Save (green check)
    const saveBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-save" });
    setIcon(saveBtn, "check");
    saveBtn.setAttribute("aria-label", "Save Changes");
    saveBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onSave(); });

    // Compendium (book)
    const compBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-compendium" });
    setIcon(compBtn, "book-open");
    compBtn.setAttribute("aria-label", "Add to Compendium");
    compBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onCompendium(); });

    // Cancel (x)
    const cancelBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-cancel" });
    setIcon(cancelBtn, "x");
    cancelBtn.setAttribute("aria-label", "Cancel");
    cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onCancel(); });
  } else {
    // Column toggle
    const colBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-column-btn ${config.isColumnActive ? "active" : ""}`,
    });
    setIcon(colBtn, "columns-2");
    colBtn.setAttribute("aria-label", "Toggle Columns");
    colBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onColumnToggle(); });

    // Edit
    const editBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-edit-btn ${config.state === "editing" ? "active" : ""}`,
    });
    setIcon(editBtn, "pen-line");
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onEdit(); });
  }
}
