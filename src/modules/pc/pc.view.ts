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
  // Monotonic counter used to bail stale async renders when setViewData is
  // called again (file switch) before compendiumsReady resolves.
  private renderGeneration = 0;
  // Exposed for tests to await the deferred render. Obsidian itself treats
  // setViewData as sync (void return) and never awaits it.
  rendered: Promise<void> = Promise.resolve();

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

    const gen = ++this.renderGeneration;
    const plugin = this.mod.core?.plugin as { compendiumsReady?: Promise<void> } | null;
    const ready = plugin?.compendiumsReady ?? Promise.resolve();

    // On cold start the compendium is still loading when this view mounts, so
    // resolver.resolve() would see an empty registry and emit spurious "not
    // found" warnings for every referenced SRD entity. Defer rendering until
    // the compendium is ready; Obsidian treats setViewData as sync (void return)
    // and doesn't await, so this doesn't block anything.
    this.renderLoadingShim();
    this.rendered = ready.then(() => {
      if (gen !== this.renderGeneration) return;
      this.renderResolvedData(data);
    });
  }

  private renderResolvedData(data: string): void {
    this.contentEl.empty();

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

  private renderLoadingShim(): void {
    this.contentEl.createDiv({ cls: "pc-loading-shim", text: "Loading compendium…" });
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
    // Tell the WorkspaceLeaf.setViewState interceptor in pc.module to treat
    // this leaf as user-opted-out of the auto-swap, so it passes our explicit
    // markdown state through instead of rewriting it back to the PC view.
    const leafId = (this.leaf as unknown as { id?: string }).id;
    const modeKey = leafId ?? this.file?.path ?? "";
    if (modeKey) this.mod.fileModes[modeKey] = "markdown";
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
