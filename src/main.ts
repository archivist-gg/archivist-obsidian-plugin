import { Plugin, Notice, setIcon } from "obsidian";

// Module-based registration
import type {
  AIToolRegistry,
  ArchivistModule,
  CoreAPI,
  RenderContext,
} from "./core/module-api";
import { ModuleRegistry } from "./core/module-registry";
import { monsterModule } from "./modules/monster/monster.module";
import { spellModule } from "./modules/spell/spell.module";
import { itemModule } from "./modules/item/item.module";
import { npcModule } from "./modules/npc/npc.module";
import { encounterModule } from "./modules/encounter/encounter.module";
import { InquiryArchivistModule } from "./modules/inquiry/inquiry.module";
import { classModule } from "./modules/class/class.module";
import { raceModule } from "./modules/race/race.module";
import { subclassModule } from "./modules/subclass/subclass.module";
import { backgroundModule } from "./modules/background/background.module";
import { featModule } from "./modules/feat/feat.module";
import { pcModule } from "./modules/pc/pc.module";

import { parseInlineTag } from "./shared/rendering/inline-tag-parser";
import { renderInlineTag } from "./shared/rendering/inline-tag-renderer";
import { createErrorBlock } from "./shared/rendering/renderer-utils";

// Edit mode scaffolding (shared across entity modules)
import { renderSideButtons } from "./shared/edit/side-buttons";

// Shared CodeMirror extensions
import { inlineTagPlugin } from "./shared/extensions/inline-tag-extension";
import { dndBlockDeleteKeymap } from "./shared/extensions/dnd-block-delete-extension";
import { CompendiumEditorSuggest } from "./shared/extensions/compendium-suggest";
import {
  compendiumRefPlugin,
  setCompendiumRefRegistry,
  setCompendiumRefPlugin,
  setCompendiumRefModuleRegistry,
  setCompendiumRefConfirmFn,
  parseCompendiumRef,
  renderCompendiumRefReadingMode,
} from "./shared/extensions/compendium-ref-extension";
import { confirm as confirmModal } from "./modules/inquiry/shared/modals/ConfirmModal";

// SRD & entities
import { SrdStore } from "./shared/ai/srd-store";
import { EntityRegistry } from "./shared/entities/entity-registry";
import { importSrdToVault } from "./shared/entities/entity-importer";
import { importSrdBundledMdToVault } from "./shared/entities/entity-md-importer";
import { CompendiumManager } from "./shared/entities/compendium-manager";
import { CompendiumSelectModal, CreateCompendiumModal } from "./shared/entities/compendium-modal";

// Settings
import type { ArchivistSettings } from "./core/plugin-settings";
import { DEFAULT_SETTINGS } from "./core/plugin-settings";

// Inquiry (Claudian chat engine) — type only; instance is created by the
// InquiryArchivistModule wrapper during its register() call.
import type { InquiryModule } from "./modules/inquiry/InquiryModule";

/**
 * In-memory AI tool registry. Modules push both a structured definition and
 * a raw SDK-tool handle during `register()`; the MCP server wiring reads
 * `getAllSdkTools()` to assemble the tool list for `createSdkMcpServer`.
 */
function createAIToolRegistry(): Required<AIToolRegistry> {
  const tools: import("./core/module-api").AIToolDefinition[] = [];
  const sdkTools: unknown[] = [];
  return {
    register(toolDef): void {
      tools.push(toolDef);
    },
    registerSdkTool(sdkTool): void {
      sdkTools.push(sdkTool);
    },
    getAll() {
      return tools.slice();
    },
    getAllSdkTools() {
      return sdkTools.slice();
    },
  };
}

export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings = { ...DEFAULT_SETTINGS };
  entityRegistry: EntityRegistry | null = null;
  compendiumManager: CompendiumManager | null = null;
  inquiry: InquiryModule | null = null;
  /** Exposed for InquiryModule.ArchivistHostPlugin hook so the in-process
   *  MCP server can consume module-contributed SDK tools without having
   *  to import each module directly. */
  getModuleSdkTools: (() => unknown[]) | null = null;
  /** Resolves once initializeCompendiums() finishes (or fails — it resolves
   *  in finally so consumers can proceed against whatever state the registry
   *  ended up in). Views that render entity references must await this before
   *  calling the resolver on cold start, else the registry is empty. */
  compendiumsReady: Promise<void>;
  private resolveCompendiumsReady!: () => void;
  private srdStore: SrdStore | null = null;
  private moduleList: ArchivistModule[] = [];
  private core: CoreAPI | null = null;

  constructor(app: ConstructorParameters<typeof Plugin>[0], manifest: ConstructorParameters<typeof Plugin>[1]) {
    super(app, manifest);
    this.compendiumsReady = new Promise<void>((resolve) => { this.resolveCompendiumsReady = resolve; });
  }

  async onload() {
    await this.loadSettings();

    // Initialize SRD store with bundled JSON data
    this.srdStore = new SrdStore();
    this.srdStore.loadFromBundledJson();

    // Initialize entity registry and compendium manager
    this.entityRegistry = new EntityRegistry();
    this.compendiumManager = new CompendiumManager(
      this.entityRegistry,
      this.app.vault,
      this.app.fileManager,
      this.settings.compendiumRoot,
    );
    setCompendiumRefRegistry(this.entityRegistry);
    setCompendiumRefPlugin(this);
    setCompendiumRefConfirmFn((app, message, confirmLabel) => confirmModal(app, message, confirmLabel ?? "OK"));

    // Initialize module registry + AI-tool registry and assemble core API
    const moduleRegistry = new ModuleRegistry();
    setCompendiumRefModuleRegistry(moduleRegistry);
    const aiToolRegistry = createAIToolRegistry();
    this.core = {
      plugin: this,
      modules: moduleRegistry,
      entities: this.entityRegistry,
      compendiums: this.compendiumManager,
      srd: this.srdStore,
      aiTools: aiToolRegistry,
    };

    // Instantiate and register modules. `InquiryArchivistModule` owns the
    // Claudian chat engine; other modules are shared singletons.
    const inquiryArchivistModule = new InquiryArchivistModule();
    this.moduleList = [
      monsterModule,
      spellModule,
      itemModule,
      npcModule,
      encounterModule,
      inquiryArchivistModule,
      classModule,
      raceModule,
      subclassModule,
      backgroundModule,
      featModule,
      pcModule,
    ];

    for (const mod of this.moduleList) {
      moduleRegistry.register(mod);
      mod.register(this.core);
      if (mod.registerAITools) {
        mod.registerAITools(aiToolRegistry);
      }
    }

    // Expose the collected SDK tools so InquiryModule can hand them to
    // createArchivistMcpServer without importing each module's ai-tools
    // directly (closes the shared/ → modules/ import edge from mcp-server).
    this.getModuleSdkTools = () => aiToolRegistry.getAllSdkTools();

    // Inquiry is instantiated inside InquiryArchivistModule.register(); hoist
    // it onto the plugin so legacy callers that still read `plugin.inquiry`
    // keep working, then drive its async init here.
    this.inquiry = inquiryArchivistModule.getInquiry();
    if (this.inquiry) {
      await this.inquiry.init();
    }

    // Register a markdown code-block processor for each module that declares
    // a `codeBlockType`. The shared helper handles view/edit toggling, side
    // buttons, compendium save, and (for monster) the column toggle.
    for (const mod of this.moduleList) {
      if (mod.codeBlockType && mod.parseYaml) {
        this.registerEntityCodeBlock(mod);
      }
    }

    // Inline tag post-processor
    this.registerMarkdownPostProcessor((element) => {
      element.querySelectorAll("code").forEach((codeEl) => {
        const text = codeEl.textContent ?? "";
        const parsed = parseInlineTag(text);
        if (parsed) {
          const tagEl = renderInlineTag(parsed);
          codeEl.replaceWith(tagEl);
        }
      });
    });

    // Compendium ref post-processor for Reading mode ({{type:slug}} -> rendered stat block).
    // Dispatches rendering through the module registry via
    // renderCompendiumRefReadingMode so this post-processor has no per-entity-type
    // knowledge.
    this.registerMarkdownPostProcessor((el) => {
      const doc = el.doc;
      const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const refPattern = /\{\{[^}]+\}\}/g;
      const textNodes: Text[] = [];
      let node: Text | null;
      while ((node = walker.nextNode() as Text)) {
        if (refPattern.test(node.textContent || "")) {
          textNodes.push(node);
        }
      }
      for (const textNode of textNodes) {
        const text = textNode.textContent || "";
        refPattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        const frag = doc.createDocumentFragment();
        let lastIdx = 0;
        while ((match = refPattern.exec(text)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(doc.createTextNode(text.substring(lastIdx, match.index)));
          }
          const ref = parseCompendiumRef(match[0]);
          if (ref && this.entityRegistry) {
            const entity = ref.entityType
              ? this.entityRegistry.getByTypeAndSlug(ref.entityType, ref.slug)
              : this.entityRegistry.getBySlug(ref.slug);
            if (entity) {
              const wrapper = doc.createElement("div");
              wrapper.classList.add("archivist-compendium-ref");
              const rendered = renderCompendiumRefReadingMode(wrapper, entity);
              if (rendered) {
                frag.appendChild(wrapper);
              } else {
                frag.appendChild(doc.createTextNode(match[0]));
              }
            } else {
              const errEl = doc.createElement("div");
              errEl.classList.add("archivist-ref-error");

              const icon = errEl.createDiv({ cls: "archivist-not-found-icon" });
              setIcon(icon, "alert-triangle");

              const textWrap = errEl.createDiv({ cls: "archivist-not-found-text" });
              textWrap.createDiv({ cls: "archivist-not-found-label", text: "Entity not found" });
              textWrap.createDiv({
                cls: "archivist-not-found-ref",
                text: match[0].replace(/[{}]/g, ""),
              });

              frag.appendChild(errEl);
            }
          } else {
            frag.appendChild(doc.createTextNode(match[0]));
          }
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < text.length) {
          frag.appendChild(doc.createTextNode(text.substring(lastIdx)));
        }
        textNode.parentNode?.replaceChild(frag, textNode);
      }
    });

    // CodeMirror editor extensions
    this.registerEditorExtension(inlineTagPlugin);
    this.registerEditorExtension(dndBlockDeleteKeymap);

    // Editor entity suggest ({{monster:, {{spell:, etc.)
    this.registerEditorSuggest(new CompendiumEditorSuggest(this.app, this.entityRegistry));

    // D&D insert commands — one per module that exposes an insert modal.
    // Command names preserve the pre-refactor wording so existing hotkey
    // bindings keep their human-readable label.
    const INSERT_COMMAND_LABELS: Record<string, string> = {
      monster: "Insert monster block",
      spell: "Insert spell block",
      item: "Insert magic item block",
    };
    for (const mod of this.moduleList) {
      const ModalCtor = mod.getInsertModal?.();
      if (!ModalCtor) continue;
      const defaultLabel = `Insert ${mod.id} block`;
      this.addCommand({
        id: `insert-${mod.id}`,
        name: INSERT_COMMAND_LABELS[mod.id] ?? defaultLabel,
        editorCallback: (editor) => {
          // ModalConstructor's return type already exposes `open(): void`, so
          // no cast is needed.
          const modal = new ModalCtor(this.app, editor);
          modal.open();
        },
      });
    }

    // Settings tab is registered by InquiryModule (unified D&D + Inquiry settings)

    // Initialize compendiums after vault index is ready (avoids race conditions
    // where getAbstractFileByPath returns null for folders that exist on disk)
    this.app.workspace.onLayoutReady(() => {
      void this.initializeCompendiums();
    });
  }

  onunload(): void {
    // Obsidian's Plugin base class types `onunload()` as `void`, so we
    // fire-and-forget the async teardown. Any destroy() rejections are
    // logged but cannot block the unload path.
    void this.teardownModules();
  }

  private async teardownModules(): Promise<void> {
    for (const mod of this.moduleList) {
      try {
        await mod.destroy?.();
      } catch (e) {
        console.error(`[archivist] module ${mod.id} destroy() failed:`, e);
      }
    }
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as { settings?: Partial<ArchivistSettings> } | null | undefined;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
  }

  async saveSettings(): Promise<void> {
    const data = ((await this.loadData()) as Record<string, unknown> | null | undefined) ?? {};
    data.settings = this.settings;
    await this.saveData(data);
  }

  private async initializeCompendiums(): Promise<void> {
    try {
      await this.initializeCompendiumsInner();
    } finally {
      this.resolveCompendiumsReady();
    }
  }

  private async initializeCompendiumsInner(): Promise<void> {
    if (!this.compendiumManager || !this.srdStore) return;

    // Check if SRD folder exists, reset srdImported if missing
    const srdPath = `${this.settings.compendiumRoot}/SRD`;
    const srdFolder = this.app.vault.getAbstractFileByPath(srdPath);
    if (this.settings.srdImported && !srdFolder) {
      this.settings.srdImported = false;
      await this.saveSettings();
    }

    // SRD import if needed, wrapped so a failure still allows discover()
    if (!this.settings.srdImported) {
      const n = new Notice("Importing SRD...", 0);
      try {
        const count = await importSrdToVault(
          this.app.vault, this.srdStore, this.settings.compendiumRoot,
          (current, total) => { n.setMessage(`Importing SRD... ${current}/${total}`); },
        );
        n.setMessage(`SRD import complete: ${count} entities`);
        activeWindow.setTimeout(() => n.hide(), 3000);
        this.settings.srdImported = true;
        await this.saveSettings();
      } catch (err) {
        n.hide();
        console.error("Archivist: SRD import failed", err);
        new Notice("SRD import failed, existing compendiums will still load.");
      }
    }

    // SRD MD bundle import — idempotent, runs every activation. Fills in
    // classes/races/subclasses/backgrounds/feats on existing vaults that
    // predate the bundled-MD pipeline without disturbing already-imported files.
    try {
      const created = await importSrdBundledMdToVault(this.app.vault, this.settings.compendiumRoot);
      if (created > 0) new Notice(`Archivist: imported ${created} bundled SRD files`);
    } catch (err) {
      console.error("Archivist: bundled SRD MD import failed", err);
    }

    // Discover all compendiums and load entities
    try {
      await this.compendiumManager.discover();
      await this.compendiumManager.loadAllEntities();
    } catch (err) {
      console.error("Archivist: compendium discovery failed", err);
    }

    // Register compendium ref extension after entities are loaded so decorations
    // can resolve references immediately (avoids "Entity not found" on open)
    this.registerEditorExtension(compendiumRefPlugin);
  }

  /**
   * Register a markdown code-block processor for an entity module.
   *
   * Handles the shared scaffolding all three entity modules (monster, spell,
   * item) use today: initial view render, side buttons (edit/save/
   * compendium/delete/column-toggle), edit-mode toggle, and save-to-
   * compendium flow. Module-specific behavior (parser, renderer, edit-mode
   * UI, whether the column toggle is shown) is supplied by the module.
   */
  private registerEntityCodeBlock(mod: ArchivistModule): void {
    const codeBlockType = mod.codeBlockType;
    const entityType = mod.entityType;
    if (!codeBlockType || !entityType || !mod.parseYaml || !mod.render) return;

    const supportsColumns = mod.supportsColumns === true;

    // Render via the module API. Returns the appended node so callers that
    // must swap it (column-toggle) can do so cheaply.
    const renderViaModule = (data: unknown, columns: number, doc: Document): HTMLElement | null => {
      const scratch = doc.createElement("div");
      const ctx: RenderContext = {
        plugin: this,
        ctx: null,
        ...(supportsColumns ? { columns } : {}),
      };
      const appended = mod.render!(scratch, data, ctx);
      const node = appended ?? (scratch.lastElementChild as HTMLElement | null);
      if (node && node.parentElement === scratch) scratch.removeChild(node);
      return node;
    };

    this.registerMarkdownCodeBlockProcessor(codeBlockType, (source, el, ctx) => {
      const result = mod.parseYaml!(source);
      if (!result.success) {
        el.appendChild(createErrorBlock(result.error, source));
        return;
      }

      let isEditMode = false;
      // `columns` only meaningful for modules that opt in; others pin to 1.
      const initialColumns = supportsColumns
        ? ((result.data as { columns?: number }).columns ?? 1)
        : 1;
      let columns = initialColumns;
      let rendered = renderViaModule(result.data, columns, el.doc);
      if (rendered) el.appendChild(rendered);

      // Side buttons container
      const sideBtns = el.createDiv({ cls: "archivist-side-btns" });

      const deleteBlock = () => {
        const info = ctx.getSectionInfo(el);
        if (!info) return;
        const editor = this.app.workspace.activeEditor?.editor;
        if (!editor) return;
        const fromLine = info.lineStart;
        const toLine = info.lineEnd;
        const totalLines = editor.lineCount();
        if (toLine + 1 < totalLines) {
          editor.replaceRange("", { line: fromLine, ch: 0 }, { line: toLine + 1, ch: 0 });
          editor.setCursor({ line: fromLine, ch: 0 });
        } else {
          const endCh = editor.getLine(toLine).length;
          if (fromLine > 0) {
            const prevLineLen = editor.getLine(fromLine - 1).length;
            editor.replaceRange("", { line: fromLine - 1, ch: prevLineLen }, { line: toLine, ch: endCh });
            editor.setCursor({ line: fromLine - 1, ch: prevLineLen });
          } else {
            editor.replaceRange("", { line: fromLine, ch: 0 }, { line: toLine, ch: endCh });
            editor.setCursor({ line: 0, ch: 0 });
          }
        }
      };

      const exitEditMode = () => {
        // Remove all children except sideBtns, then restore view mode
        Array.from(el.children).forEach((child) => {
          if (child !== sideBtns) child.remove();
        });
        isEditMode = false;
        rendered = renderViaModule(result.data, columns, el.doc);
        if (rendered) el.insertBefore(rendered, sideBtns);
        sideBtns.removeClass("always-visible");
        updateSideButtons();
      };

      const enterEditMode = () => {
        isEditMode = true;
        // Clear view mode content
        rendered?.remove();
        sideBtns.addClass("always-visible");
        // Delegate to the module's edit-mode renderer. The modules read
        // `plugin` / `ctx` from the EditContext and invoke `onExit` when
        // they need to restore the view-mode render without a content
        // change (e.g. cancel with no edits).
        mod.renderEditMode?.(el, result.data, {
          plugin: this,
          ctx,
          source,
          onExit: exitEditMode,
        });
      };

      const openCompendiumSave = () => {
        if (!this.compendiumManager) return;
        const writable = this.compendiumManager.getWritable();
        const saveToComp = async (comp: { name: string }) => {
          try {
            const registered = await this.compendiumManager!.saveEntity(
              comp.name, entityType, result.data as Record<string, unknown>,
            );
            const sectionInfo = ctx.getSectionInfo(el);
            if (sectionInfo) {
              const editor = this.app.workspace.activeEditor?.editor;
              if (editor) {
                const from = { line: sectionInfo.lineStart, ch: 0 };
                const to = { line: sectionInfo.lineEnd, ch: editor.getLine(sectionInfo.lineEnd).length };
                editor.replaceRange(`{{${entityType}:${registered.slug}}}`, from, to);
              }
            }
            new Notice(`Saved to ${comp.name}`);
          } catch (e: unknown) {
            new Notice(`Failed to save: ${e instanceof Error ? e.message : String(e)}`);
          }
        };
        const saveToCompVoid = (comp: { name: string }) => { void saveToComp(comp); };
        if (writable.length === 0) {
          new CreateCompendiumModal(this.app, this.compendiumManager, saveToCompVoid).open();
        } else {
          new CompendiumSelectModal(this.app, writable, saveToCompVoid, this.compendiumManager).open();
        }
      };

      const updateSideButtons = () => {
        renderSideButtons(sideBtns, {
          state: isEditMode ? "editing" : "default",
          isColumnActive: supportsColumns && columns === 2,
          showColumnToggle: supportsColumns,
          onEdit: () => {
            if (isEditMode) {
              exitEditMode();
            } else {
              enterEditMode();
            }
          },
          onSave: () => {}, // handled by edit mode internally
          onSaveAsNew: () => {},
          onCompendium: openCompendiumSave,
          onCancel: () => exitEditMode(),
          onDelete: deleteBlock,
          onColumnToggle: () => {
            if (!supportsColumns) return;
            columns = columns === 1 ? 2 : 1;
            const newRendered = renderViaModule(result.data, columns, el.doc);
            if (newRendered && rendered) {
              rendered.replaceWith(newRendered);
              rendered = newRendered;
            }
            updateSideButtons();
          },
        });
      };
      updateSideButtons();
    });
  }
}
