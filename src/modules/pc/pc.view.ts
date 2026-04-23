import { TextFileView, type WorkspaceLeaf } from "obsidian";
import { renderPCSheet, renderPCSheetError } from "./pc.sheet";
import { extractPCCodeBlock, parsePC } from "./pc.parser";
import { recalc } from "./pc.recalc";
import type { PCModule } from "./pc.module";
import type { ResolvedCharacter, DerivedStats } from "./pc.types";

export const VIEW_TYPE_PC = "archivist-pc-sheet";

export class PCSheetView extends TextFileView {
  private rawFileData = "";
  private character: ResolvedCharacter | null = null;
  private derived: DerivedStats | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly mod: PCModule,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PC;
  }
  getIcon(): string {
    return "user";
  }
  getDisplayText(): string {
    return this.file?.basename ?? "Character Sheet";
  }

  setViewData(data: string, clear: boolean): void {
    this.rawFileData = data;
    if (clear) this.contentEl.empty();

    const extracted = extractPCCodeBlock(data);
    if (!extracted) return this.showError("No `pc` code block found in this file.");

    const parsed = parsePC(extracted.yaml);
    if (!parsed.success) return this.showError(parsed.error);

    if (!this.mod.resolver) return this.showError("PC module not initialized.");
    const resolveResult = this.mod.resolver.resolve(parsed.data);
    this.character = resolveResult.character;
    this.derived = recalc(this.character);
    this.renderSheet([...resolveResult.warnings, ...this.derived.warnings]);
  }

  getViewData(): string {
    return this.rawFileData;
  }

  clear(): void {
    this.character = null;
    this.derived = null;
    this.contentEl.empty();
  }

  async onOpen(): Promise<void> {
    this.addAction("pencil", "Edit as Markdown", () => {
      void this.switchToMarkdown();
    });
    await Promise.resolve();
  }

  private async switchToMarkdown(): Promise<void> {
    await this.leaf.setViewState({
      type: "markdown",
      state: { file: this.file?.path },
      active: true,
    });
  }

  private renderSheet(warnings: string[]): void {
    if (!this.character || !this.derived || !this.mod.core) return;
    renderPCSheet({
      root: this.contentEl,
      resolved: this.character,
      derived: this.derived,
      registry: this.mod.registry,
      core: this.mod.core,
      warnings,
    });
  }

  private showError(message: string): void {
    renderPCSheetError(this.contentEl, message, () => {
      void this.switchToMarkdown();
    });
  }
}
