import { type App, Modal, Setting } from "obsidian";

export function confirmDelete(app: App, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, message, resolve).open();
  });
}

export function confirm(app: App, message: string, confirmText: string): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, message, resolve, confirmText).open();
  });
}

class ConfirmModal extends Modal {
  private message: string;
  private resolve: (confirmed: boolean) => void;
  private resolved = false;
  private confirmText: string;

  constructor(app: App, message: string, resolve: (confirmed: boolean) => void, confirmText?: string) {
    super(app);
    this.message = message;
    this.resolve = resolve;
    this.confirmText = confirmText ?? "Delete";
  }

  onOpen(): void {
    this.setTitle("Confirm");
    this.modalEl.addClass("archivist-confirm-modal");

    this.contentEl.createEl("p", { text: this.message });

    new Setting(this.contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((btn) =>
        btn
          .setButtonText(this.confirmText)
          .setWarning()
          .onClick(() => {
            this.resolved = true;
            this.resolve(true);
            this.close();
          }),
      );
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolve(false);
    }
    this.contentEl.empty();
  }
}
