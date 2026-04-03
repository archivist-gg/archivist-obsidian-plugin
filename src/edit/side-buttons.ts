import { setIcon } from "obsidian";

export type SideButtonState = "default" | "editing" | "pending";

interface SideButtonConfig {
  state: SideButtonState;
  onSource: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCompendium: () => void;
  onCancel: () => void;
  onDelete: () => void;
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
    // Source button (</>) — FIRST
    const sourceBtn = container.createDiv({ cls: "archivist-side-btn" });
    setIcon(sourceBtn, "code");
    sourceBtn.setAttribute("aria-label", "Edit Source");
    sourceBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onSource(); });

    // Column toggle — icon changes based on state
    const colBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-column-btn ${config.isColumnActive ? "active" : ""}`,
    });
    setIcon(colBtn, config.isColumnActive ? "layout-list" : "columns-2");
    colBtn.setAttribute("aria-label", "Toggle Columns");
    colBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onColumnToggle(); });

    // Edit
    const editBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-edit-btn ${config.state === "editing" ? "active" : ""}`,
    });
    setIcon(editBtn, "pen-line");
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onEdit(); });

    // Delete — LAST
    const deleteBtn = container.createDiv({ cls: "archivist-side-btn" });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.setAttribute("aria-label", "Delete Block");
    deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onDelete(); });
  }
}
