import { Modal, Notice, type App, type TFile } from "obsidian";
import { PORTRAIT_IMAGE_EXTENSIONS } from "../pc.portrait";

export interface PortraitPickerOptions {
  pcFile: TFile;
  hasPortrait: boolean;
  /** Guard: the view still shows the file captured at open (spec F11). */
  isCurrentFile: () => boolean;
  /** Called with the chosen image TFile — vault pick AND completed import both land here. */
  onPick: (image: TFile) => void;
  onRemove: () => void;
}

const IMPORT_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp";

export class PortraitPickerModal extends Modal {
  private listEl!: HTMLElement;
  private searchTerm = "";

  constructor(app: App, private readonly opts: PortraitPickerOptions) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("archivist-modal", "pc-portrait-picker");
    this.contentEl.createEl("h2", { text: "Character portrait" });

    const actions = this.contentEl.createDiv({ cls: "pc-portrait-picker-actions" });

    const importInput = this.contentEl.createEl("input", {
      cls: "pc-portrait-picker-file-input",
      attr: { type: "file", accept: IMPORT_ACCEPT },
    });
    importInput.addEventListener("change", () => void this.handleImport(importInput));

    const importRow = actions.createDiv({ cls: "pc-portrait-picker-action" });
    importRow.setText("Import from computer...");
    importRow.addEventListener("click", () => importInput.click());

    if (this.opts.hasPortrait) {
      const removeRow = actions.createDiv({ cls: "pc-portrait-picker-action" });
      removeRow.setText("Remove current image");
      removeRow.addEventListener("click", () => this.commit(() => this.opts.onRemove()));
    }

    const search = this.contentEl.createEl("input", {
      attr: { type: "text", placeholder: "Search images..." },
    });
    search.addEventListener("input", () => {
      this.searchTerm = search.value.toLowerCase();
      this.renderList();
    });

    this.listEl = this.contentEl.createDiv({ cls: "pc-portrait-picker-list" });
    this.renderList();

    const buttons = this.contentEl.createDiv({ cls: "archivist-modal-buttons" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
  }

  private renderList(): void {
    this.listEl.empty();
    const images = this.app.vault
      .getFiles()
      .filter((f) => PORTRAIT_IMAGE_EXTENSIONS.has(f.extension.toLowerCase()))
      .filter((f) => this.searchTerm.length === 0 || f.path.toLowerCase().includes(this.searchTerm))
      .sort((a, b) => (a.path < b.path ? -1 : 1));

    if (images.length === 0) {
      this.listEl.createEl("p", {
        cls: "pc-portrait-picker-empty",
        // eslint-disable-next-line obsidianmd/ui/sentence-case -- "Import from computer" echoes the button label above verbatim
        text: "No images in this vault. Use Import from computer.",
      });
      return;
    }

    for (const file of images) {
      const row = this.listEl.createDiv({ cls: "pc-portrait-picker-row" });
      row.createEl("img", { attr: { src: this.app.vault.getResourcePath(file), alt: "" } });
      row.createSpan({ text: file.path });
      row.addEventListener("click", () => this.commit(() => this.opts.onPick(file)));
    }
  }

  private async handleImport(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const path = await this.app.fileManager.getAvailablePathForAttachment(file.name, this.opts.pcFile.path);
      const created = await this.app.vault.createBinary(path, buf);
      this.commit(() => this.opts.onPick(created));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      new Notice("Import failed: " + message);
    }
  }

  /** Guard on every commit path (pick/import/remove) — the view may have
   * navigated away while the modal was open. */
  private commit(run: () => void): void {
    if (!this.opts.isCurrentFile()) {
      new Notice("The view no longer shows this character. Portrait not changed.");
      this.close();
      return;
    }
    run();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
