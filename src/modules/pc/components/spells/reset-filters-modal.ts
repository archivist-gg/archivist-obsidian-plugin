import { type App, Modal, Setting } from "obsidian";

/** Standard Obsidian confirm dialog for the add-drawer "Reset filters" action.
 *  Calls `onConfirm` only when the user clicks the warning Reset button. */
export function confirmResetFilters(app: App, onConfirm: () => void): void {
  new ResetFiltersModal(app, onConfirm).open();
}

class ResetFiltersModal extends Modal {
  constructor(app: App, private readonly onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Reset filters?");
    this.contentEl.addClass("archivist-modal");
    this.contentEl.createEl("p", { text: "Clear all spell filters and the search box?" });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b.setButtonText("Reset").setWarning().onClick(() => {
          this.onConfirm();
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
