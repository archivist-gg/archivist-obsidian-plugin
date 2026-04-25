import { TextFileView, type WorkspaceLeaf } from "obsidian";
import { renderPCSheet, renderPCSheetError } from "./pc.sheet";
import { extractPCCodeBlock, parsePC, spliceCodeBlock } from "./pc.parser";
import { recalc } from "./pc.recalc";
import { CharacterEditState } from "./pc.edit-state";
import type { PCModule } from "./pc.module";
import type { ResolvedCharacter, DerivedStats } from "./pc.types";

export const VIEW_TYPE_PC = "archivist-pc-sheet";

export class PCSheetView extends TextFileView {
  private rawFileData = "";
  private character: ResolvedCharacter | null = null;
  private derived: DerivedStats | null = null;
  private editState: CharacterEditState | null = null;
  private codeBlockRange: { startLine: number; endLine: number } | null = null;
  private lastWrittenData: string | null = null;
  // Track whether editState has been mutated since the file was loaded.
  // Before any mutation, getViewData() returns the raw file bytes so that
  // no-op Obsidian save triggers do not normalize the YAML formatting.
  private isDirty = false;
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
    // Loop guard: Obsidian echoes our just-written bytes back through
    // setViewData after save. Short-circuit before re-running the render
    // pipeline (which would rebuild the entire sheet and re-create editState,
    // losing in-flight session state). Normalize CRLF→LF on both sides so the
    // guard still fires on Windows, where TextFileView.save() rewrites with
    // CRLF after our spliceCodeBlock emits LF-joined bytes.
    const normalized = data.replace(/\r\n/g, "\n");
    if (this.lastWrittenData !== null && normalized === this.lastWrittenData) {
      this.rawFileData = data;
      return;
    }
    this.rawFileData = data;
    this.isDirty = false;
    this.lastWrittenData = null;
    // Null the current-load fields so a queued handleChange microtask (from a
    // prior UI event) that fires after setViewData resets state but before the
    // deferred ready.then() runs hits the `!this.editState` early-return
    // instead of mutating this.character/derived with values derived from a
    // stale editState.
    this.editState = null;
    this.codeBlockRange = null;
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
    this.derived = recalc(this.character, this.mod.resolver.registry);
    this.codeBlockRange = { startLine: extracted.startLine, endLine: extracted.endLine };
    this.editState = new CharacterEditState(
      parsed.data,
      () => ({ resolved: this.character!, derived: this.derived! }),
      () => this.handleChange(),
    );
    this.renderSheet([...resolveResult.warnings, ...this.derived.warnings]);
  }

  private handleChange(): void {
    const gen = this.renderGeneration;
    if (!this.editState || !this.mod.resolver) return;

    // Mark dirty BEFORE the try so we persist the mutation even when the
    // resolver/recalc/render chain blows up — the editState already mutated
    // the character and the user's edit would otherwise be lost on close.
    this.isDirty = true;

    try {
      const character = this.editState.getCharacter();
      const resolveResult = this.mod.resolver.resolve(character);
      this.character = resolveResult.character;
      this.derived = recalc(this.character, this.mod.resolver.registry);

      // Stale-render bail: a newer setViewData has started, the in-flight
      // derivation is from the old editState — do not render OR save.
      if (gen !== this.renderGeneration) return;

      this.renderSheet([...resolveResult.warnings, ...this.derived.warnings]);
    } catch (err) {
      console.error("[pc] handleChange failed — edit was applied to state, persisting anyway:", err);
      const message = err instanceof Error ? err.message : String(err);
      this.showError(`Render failed: ${message}. Your edit was saved.`);
    }

    this.requestSave();
  }

  private renderLoadingShim(): void {
    this.contentEl.createDiv({ cls: "pc-loading-shim", text: "Loading compendium…" });
  }

  getViewData(): string {
    if (!this.editState || !this.codeBlockRange || !this.isDirty) return this.rawFileData;
    const newYamlBody = this.editState.toYaml();
    const spliced = spliceCodeBlock(this.rawFileData, this.codeBlockRange, newYamlBody);
    this.lastWrittenData = spliced;
    return spliced;
  }

  clear(): void {
    this.character = null;
    this.derived = null;
    this.editState = null;
    this.codeBlockRange = null;
    this.lastWrittenData = null;
    this.isDirty = false;
    this.contentEl.empty();
  }

  async onOpen(): Promise<void> {
    this.addAction("pencil", "Edit as Markdown", () => {
      void this.switchToMarkdown();
    });
    await Promise.resolve();
  }

  async onLoadFile(file: import("obsidian").TFile): Promise<void> {
    // Obsidian calls this when the view's underlying file changes. Reset all
    // SP4 mutation/persistence state so no stale references survive across
    // file switches (especially lastWrittenData, which would otherwise cause
    // the setViewData loop guard to wrongly suppress a re-render if the new
    // file's bytes happen to match the previous file's last splice).
    // setViewData() will repopulate state once the new file's contents arrive.
    this.editState = null;
    this.codeBlockRange = null;
    this.lastWrittenData = null;
    this.isDirty = false;
    await super.onLoadFile(file);
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
      editState: this.editState,
      warnings,
    });
  }

  private showError(message: string): void {
    renderPCSheetError(this.contentEl, message, () => {
      void this.switchToMarkdown();
    });
  }
}
