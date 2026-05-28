import { setIcon } from "obsidian";

export type SideButtonState = "default" | "editing" | "pending" | "compendium-pending";

interface SideButtonConfig {
  state: SideButtonState;
  onEdit: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onCompendium: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDeleteRef?: () => void;
  onDeleteEntity?: () => void;
  onJumpToRef?: () => void;
  onColumnToggle: () => void;
  isColumnActive: boolean;
  showColumnToggle?: boolean;
  isReadonly?: boolean;
}

export function renderSideButtons(container: HTMLElement, config: SideButtonConfig): void {
  container.empty();
  container.addClass("archivist-side-btns");

  if (config.state === "compendium-pending") {
    // Save button (only if writable)
    if (!config.isReadonly) {
      const saveBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-save" });
      setIcon(saveBtn, "save");
      saveBtn.title = "Save to compendium";
      saveBtn.addEventListener("click", config.onSave);
    }
    // Save As New button (save icon with + overlay)
    const saveAsNewBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-save-as-new" });
    setIcon(saveAsNewBtn, "save");
    saveAsNewBtn.createSpan({ cls: "archivist-plus-overlay", text: "+" });
    saveAsNewBtn.title = "Save as new entity";
    saveAsNewBtn.addEventListener("click", config.onSaveAsNew);
    // Cancel button
    const cancelBtn = container.createDiv({ cls: "archivist-side-btn" });
    setIcon(cancelBtn, "x");
    cancelBtn.title = "Cancel";
    cancelBtn.addEventListener("click", config.onCancel);
    return;
  }

  if (config.state === "pending") {
    // Save (green check)
    const saveBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-save" });
    setIcon(saveBtn, "check");
    saveBtn.setAttribute("aria-label", "Save changes");
    saveBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onSave(); });

    // Compendium (book)
    const compBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-compendium" });
    setIcon(compBtn, "book-open");
    compBtn.setAttribute("aria-label", "Add to compendium");
    compBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onCompendium(); });

    // Cancel (x)
    const cancelBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-cancel" });
    setIcon(cancelBtn, "x");
    cancelBtn.setAttribute("aria-label", "Cancel");
    cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onCancel(); });
  } else {
    // Jump to reference — first button (only for compendium ref widgets)
    if (config.onJumpToRef) {
      const jumpBtn = container.createDiv({ cls: "archivist-side-btn" });
      setIcon(jumpBtn, "scroll-text");
      jumpBtn.setAttribute("aria-label", "Open in compendium");
      jumpBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onJumpToRef!(); });
    }

    // Column toggle — icon changes based on state (only for blocks that support columns)
    if (config.showColumnToggle !== false) {
      const colBtn = container.createDiv({
        cls: `archivist-side-btn archivist-block-column-btn ${config.isColumnActive ? "active" : ""}`,
      });
      setIcon(colBtn, config.isColumnActive ? "layout-list" : "columns-2");
      colBtn.setAttribute("aria-label", "Toggle columns");
      colBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onColumnToggle(); });
    }

    // Edit
    const editBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-edit-btn ${config.state === "editing" ? "active" : ""}`,
    });
    setIcon(editBtn, "pen-line");
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onEdit(); });

    // Delete — LAST — expands into sub-menu
    const deleteBtn = container.createDiv({ cls: "archivist-side-btn" });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.setAttribute("aria-label", "Delete");

    if (config.onDeleteRef || config.onDeleteEntity) {
      // Expandable delete sub-menu
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = container.hasClass("archivist-delete-menu-open");
        if (isOpen) {
          container.removeClass("archivist-delete-menu-open");
          container.querySelectorAll(".archivist-delete-sub-btn").forEach((el) => el.remove());
          setIcon(deleteBtn, "trash-2");
          return;
        }

        // Switch trash to X (close)
        container.addClass("archivist-delete-menu-open");
        setIcon(deleteBtn, "x");

        // Add sub-buttons after the delete button
        if (config.onDeleteRef) {
          const refBtn = container.createDiv({ cls: "archivist-side-btn archivist-delete-sub-btn" });
          setIcon(refBtn, "file-x");
          refBtn.setAttribute("aria-label", "Remove reference from document");
          refBtn.title = "Remove reference";
          refBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            config.onDeleteRef!();
          });
        }

        if (config.onDeleteEntity) {
          const entityBtn = container.createDiv({
            cls: "archivist-side-btn archivist-delete-sub-btn archivist-delete-entity-btn",
          });
          setIcon(entityBtn, "book-x");
          entityBtn.setAttribute("aria-label", "Delete entity from compendium");
          entityBtn.title = "Delete from compendium";
          entityBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            config.onDeleteEntity!();
          });
        }
      });
    } else {
      // Simple delete (code block path — existing behavior)
      deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onDelete(); });
    }
  }
}
