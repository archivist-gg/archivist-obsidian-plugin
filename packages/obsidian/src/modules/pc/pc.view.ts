import { Notice, TextFileView, type WorkspaceLeaf } from "obsidian";
import { renderPCSheet, renderPCSheetError } from "./pc.sheet";
import { extractPCCodeBlock, spliceCodeBlock } from "./pc.parser";
import { readFrontmatterValue, spliceFrontmatterKey } from "./pc.frontmatter";
import {
  PORTRAIT_KEY,
  PORTRAIT_IMAGE_EXTENSIONS,
  normalizeLinkValue,
  wikiLinkFor,
  getPortraitsFolder,
} from "./pc.portrait";
import { PortraitPickerModal } from "./components/portrait-picker-modal";
import { parsePC } from "@archivist-gg/dnd5e/pc/pc.parser";
import { recalc } from "@archivist-gg/dnd5e/pc/pc.recalc";
import { seedFeatureUses } from "./pc.resource-seed";
import { CharacterEditState } from "./pc.edit-state";
import type { PCModule } from "./pc.module";
import type { ResolvedCharacter, DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";

export const VIEW_TYPE_PC = "archivist-pc-sheet";

const DEFAULT_ACTIVE_TAB = "panel-actions";

export class PCSheetView extends TextFileView {
  private rawFileData = "";
  private character: ResolvedCharacter | null = null;
  private derived: DerivedStats | null = null;
  private editState: CharacterEditState | null = null;
  private codeBlockRange: { startLine: number; endLine: number } | null = null;
  private lastWrittenData: string | null = null;
  private portraitUrl: string | null = null;
  private lastWarnings: string[] = [];
  // Track whether editState has been mutated since the file was loaded.
  // Before any mutation, getViewData() returns the raw file bytes so that
  // no-op Obsidian save triggers do not normalize the YAML formatting.
  private isDirty = false;
  // Monotonic counter used to bail stale async renders when setViewData is
  // called again (file switch) before compendiumsReady resolves.
  private renderGeneration = 0;
  // Currently-active tab panel id. Lifted up here from TabsContainer so it
  // survives the renderSheet-driven re-render that every editState mutation
  // triggers (root.empty() in renderPCSheet wipes the tab DOM, and without
  // this anchor the container would always re-activate the first tab).
  // Reset only on file switch (onLoadFile / setViewData(clear=true) / clear),
  // never on internal mutations.
  private activeTabId: string = DEFAULT_ACTIVE_TAB;
  // Builder step + transient builder UI state (search/filter/expand), lifted
  // for the same survival reason as activeTabId. Reset on file switch only.
  private activeStepId: string | null = null;
  private builderUiState = new Map<string, unknown>();
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
    this.portraitUrl = null;
    this.lastWarnings = [];
    // Reset active tab on file switch — opening a different PC should land
    // the user on Actions, not whatever tab the previous PC happened to be on.
    this.activeTabId = DEFAULT_ACTIVE_TAB;
    this.activeStepId = null;
    this.builderUiState = new Map();
    if (clear) this.contentEl.empty();

    const gen = ++this.renderGeneration;
    const plugin = this.mod.services?.plugin as { compendiumsReady?: Promise<void> } | null;
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
    this.derived = recalc(this.character, this.mod.resolver?.registry);
    seedFeatureUses(this.character, this.derived);
    this.codeBlockRange = { startLine: extracted.startLine, endLine: extracted.endLine };
    this.editState = new CharacterEditState(
      parsed.data,
      () => ({ resolved: this.character!, derived: this.derived! }),
      () => this.handleChange(),
      this.mod.resolver?.registry ?? null,
    );
    this.lastWarnings = [...resolveResult.warnings, ...this.derived.warnings];
    this.portraitUrl = this.resolvePortrait();
    this.renderSheet(this.lastWarnings);
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
      this.derived = recalc(this.character, this.mod.resolver?.registry);
      seedFeatureUses(this.character, this.derived);

      // Stale-render bail: a newer setViewData has started, the in-flight
      // derivation is from the old editState — do not render OR save.
      if (gen !== this.renderGeneration) return;

      this.lastWarnings = [...resolveResult.warnings, ...this.derived.warnings];
      this.renderSheet(this.lastWarnings);
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
    this.portraitUrl = null;
    this.lastWarnings = [];
    this.activeTabId = DEFAULT_ACTIVE_TAB;
    this.activeStepId = null;
    this.builderUiState = new Map();
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
    this.portraitUrl = null;
    this.lastWarnings = [];
    this.activeTabId = DEFAULT_ACTIVE_TAB;
    this.activeStepId = null;
    this.builderUiState = new Map();
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
    if (!this.character || !this.derived || !this.mod.services) return;
    renderPCSheet({
      root: this.contentEl,
      resolved: this.character,
      derived: this.derived,
      registry: this.mod.registry,
      services: this.mod.services,
      app: this.app,
      editState: this.editState,
      warnings,
      activeTabId: this.activeTabId,
      onActiveTabChange: (panelId) => {
        this.activeTabId = panelId;
      },
      activeStepId: this.activeStepId ?? undefined,
      onActiveStepChange: (stepId) => {
        this.activeStepId = stepId;
      },
      builderUiState: this.builderUiState,
      portraitUrl: this.portraitUrl,
      onOpenPortraitPicker: () => this.openPortraitPicker(),
    });
  }

  private showError(message: string): void {
    renderPCSheetError(this.contentEl, message, () => {
      void this.switchToMarkdown();
    });
  }

  private resolvePortrait(): string | null {
    const app = this.app as unknown as {
      metadataCache?: { getFirstLinkpathDest?: (l: string, s: string) => { extension: string } | null };
      vault?: { getResourcePath?: (f: unknown) => string };
    };
    if (!this.file || !app?.metadataCache?.getFirstLinkpathDest || !app?.vault?.getResourcePath) return null;
    const rawLink = readFrontmatterValue(this.rawFileData, PORTRAIT_KEY);
    if (!rawLink) return null;
    const linkpath = normalizeLinkValue(rawLink);
    if (!linkpath) return null;
    const tfile = app.metadataCache.getFirstLinkpathDest(linkpath, this.file.path);
    if (!tfile || !PORTRAIT_IMAGE_EXTENSIONS.has(tfile.extension.toLowerCase())) return null;
    return app.vault.getResourcePath(tfile);
  }

  applyPortrait(link: string | null, preResolvedUrl?: string | null): void {
    const spliced = spliceFrontmatterKey(this.rawFileData, PORTRAIT_KEY, link);
    if (spliced === null) {
      new Notice("This file has no frontmatter, cannot set a portrait.");
      return;
    }
    this.rawFileData = spliced;
    // Frontmatter edit shifts every line below it — recompute the pc code
    // block's line range from the spliced bytes, or the next pc-block splice
    // would land at stale line numbers and corrupt the file (RISK-1).
    const extracted = extractPCCodeBlock(this.rawFileData);
    this.codeBlockRange = extracted
      ? { startLine: extracted.startLine, endLine: extracted.endLine }
      : null;
    this.portraitUrl = preResolvedUrl !== undefined ? preResolvedUrl : this.resolvePortrait();
    this.renderSheet(this.lastWarnings);
    this.lastWrittenData = this.getViewData();
    this.requestSave();
  }

  private openPortraitPicker(): void {
    const file = this.file;
    if (!file) return;
    const app = this.app as unknown as {
      metadataCache: { fileToLinktext: (f: unknown, s: string) => string };
      vault: { getResourcePath: (f: unknown) => string };
    };
    new PortraitPickerModal(this.app, {
      pcFile: file,
      hasPortrait: readFrontmatterValue(this.rawFileData, PORTRAIT_KEY) !== null,
      // TODO(P4b T5): resolve from real plugin settings; this bridges the
      // new required option until T5 wires the settings source through.
      portraitsFolder: getPortraitsFolder(undefined),
      isCurrentFile: () => this.file?.path === file.path,
      onPick: (image) => {
        this.applyPortrait(
          wikiLinkFor(app.metadataCache.fileToLinktext(image, file.path)),
          app.vault.getResourcePath(image),
        );
      },
      onRemove: () => this.applyPortrait(null),
    }).open();
  }
}
