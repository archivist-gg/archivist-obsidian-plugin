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
import { InquiryArchivistModule } from "./modules/inquiry/inquiry.module";
import { classModule } from "./modules/class/class.module";
import { raceModule } from "./modules/race/race.module";
import { subclassModule } from "./modules/subclass/subclass.module";
import { backgroundModule } from "./modules/background/background.module";
import { featModule } from "./modules/feat/feat.module";
import { optionalFeatureModule } from "./modules/optional-feature/optional-feature.module";
import { pcModule } from "./modules/pc/pc.module";
import { armorModule } from "./modules/armor/armor.module";
import { weaponModule } from "./modules/weapon/weapon.module";

import { parseInlineTag } from "@archivist/dnd5e/inline-tag-parser";
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
  setCompendiumRefConfirmFn,
  parseCompendiumRef,
  renderCompendiumRefReadingMode,
} from "./shared/extensions/compendium-ref-extension";
import { confirm as confirmModal } from "./modules/inquiry/shared/modals/ConfirmModal";

// SRD & entities
import { SrdStore, dnd5ePack } from "@archivist/dnd5e";
import { generatableToSdkTool } from "@archivist/generators";
import { EntityRegistry, createArchivist } from "@archivist/core";
import type { Archivist } from "@archivist/core";

// Strangler adapter: kernel + Obsidian ports
import {
  makeVaultStoragePort,
  makeRegistryContentPort,
  makeNoticeSink,
} from "./adapter/obsidian-ports";
import type { EntityPresenter } from "./shared/rendering/entity-presenter";
import {
  setEntityPresenters,
  setEntityPresenterKernel,
  setEntityPresenterPlugin,
} from "./shared/rendering/entity-presenter-dispatch";
import { bootstrapCompendiums } from "./shared/compendium-init/wiring";
import { CompendiumManager } from "./shared/entities/compendium-manager";
import { CompendiumSelectModal, CreateCompendiumModal } from "./shared/entities/compendium-modal";

// Settings
import type { ArchivistSettings } from "./core/plugin-settings";
import { DEFAULT_SETTINGS } from "./core/plugin-settings";

// Inquiry (Claudian chat engine) — type only; instance is created by the
// InquiryArchivistModule wrapper during its register() call.
import type { InquiryModule } from "./modules/inquiry/InquiryModule";

/**
 * In-memory AI tool registry. The generation bridge pushes one raw SDK-tool
 * handle per pack Generatable; the MCP server wiring reads `getAllSdkTools()`
 * to assemble the tool list for `createSdkMcpServer`.
 */
function createAIToolRegistry(): Required<AIToolRegistry> {
  const sdkTools: unknown[] = [];
  return {
    registerSdkTool(sdkTool): void {
      sdkTools.push(sdkTool);
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
  /** Core kernel (strangler). Parses entity docs via registered packs; the
   *  legacy CoreAPI (`this.core`) still serves not-yet-migrated modules. */
  archivist!: Archivist;
  /** DOM-facing presenters keyed by entity type. */
  private presenters = new Map<string, EntityPresenter>();
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
    const aiToolRegistry = createAIToolRegistry();
    this.core = {
      plugin: this,
      modules: moduleRegistry,
      entities: this.entityRegistry,
      compendiums: this.compendiumManager,
      srd: this.srdStore,
      aiTools: aiToolRegistry,
    };

    // --- new core wiring (strangler) ---
    // The kernel parses entity docs via registered packs; the presenter map
    // holds each entity type's DOM render/edit callbacks. The map is built from
    // the direct presenter list below. The legacy CoreAPI (`this.core`) keeps
    // serving not-yet-migrated modules (inquiry + pc).
    this.archivist = createArchivist({
      storage: makeVaultStoragePort(this.app.vault),
      content: makeRegistryContentPort(this.entityRegistry),
      notify: makeNoticeSink(),
    });

    // Instantiate and register modules. `InquiryArchivistModule` owns the
    // Claudian chat engine; the 11 entity types are native EntityPresenters
    // (0f/T2) and no longer ArchivistModules — only inquiry (and pc, wired
    // separately below) still rides the legacy module loop.
    const inquiryArchivistModule = new InquiryArchivistModule();
    this.moduleList = [inquiryArchivistModule];

    // The 11 entity presenters: how each authored type is DRAWN. Keyed by
    // `type` into the presenter map the shared dispatch reads (D3/D4).
    const presenterList: EntityPresenter[] = [
      monsterModule, spellModule, itemModule, classModule, raceModule,
      subclassModule, backgroundModule, featModule, optionalFeatureModule,
      armorModule, weaponModule,
    ];
    this.presenters = new Map(presenterList.map((p) => [p.type, p]));

    // Register the remaining ArchivistModules through the legacy module system
    // (Bridge 3 now serves inquiry + pc only). pc is wired separately below
    // (0e removed its Bridge-1 tenancy). npc/encounter are generatable-only
    // pack members (no module).
    for (const mod of this.moduleList) {
      moduleRegistry.register(mod);
      mod.register(this.core);
    }
    // Inject the presenter map + kernel + plugin into the shared dispatch
    // (D2). Placement is a few lines after where the old setCompendiumRef*
    // setters sat: the map is built from presenterList above and the kernel is
    // `this.archivist`. Nothing renders during onload between these points, so
    // the ordering is non-observable (spec D4).
    setEntityPresenters(this.presenters);
    setEntityPresenterPlugin(this);
    setEntityPresenterKernel(this.archivist);
    // Register the real dnd5e pack (the only pack now — the legacy strangler
    // pack was removed with Bridge 1 in 0e).
    this.archivist.registerPack(dnd5ePack);
    // Direct composition: pc is a stateful-app, not a registry tenant (0e).
    // Wired outside the ArchivistModule loop; retains CoreAPI service access
    // until the Bridge 3 teardown in 0f.
    pcModule.register(this.core);
    // B7 generation bridge: register one SDK generate-tool per pack Generatable.
    // The pack owns the generate contract; the generic mapper turns each
    // Generatable into an SDK tool with no domain knowledge. This replaces the
    // per-module manual registerSdkTool calls (retired type-by-type this phase).
    for (const et of dnd5ePack.entityTypes) {
      if (et.generatable) {
        aiToolRegistry.registerSdkTool(generatableToSdkTool(et.generatable));
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

    // Register a markdown code-block processor for each entity presenter. The
    // shared helper handles view/edit toggling, side buttons, compendium save,
    // and (for monster) the column toggle.
    for (const p of presenterList) {
      this.registerEntityCodeBlock(p);
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
    for (const p of presenterList) {
      const ModalCtor = p.getInsertModal?.();
      if (!ModalCtor) continue;
      const defaultLabel = `Insert ${p.type} block`;
      this.addCommand({
        id: `insert-${p.type}`,
        name: INSERT_COMMAND_LABELS[p.type] ?? defaultLabel,
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

    // Canonical pipeline bootstrap: delete the legacy `Compendium/SRD/` folder,
    // then copy the embedded `SRD 5e/` and `SRD 2024/` bundles into the vault.
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- proper noun: "SRD" is an acronym (System Reference Document)
    const n = new Notice("Archivist: setting up SRD compendiums...", 0);
    try {
      const result = await bootstrapCompendiums({
        vault: this.app.vault,
        fileManager: this.app.fileManager,
        rootFolder: this.settings.compendiumRoot,
        pluginVersion: this.manifest.version,
        removeLegacySrdFolder: true,
      });
      const copied = result.perCompendium.filter(c => c.action === "copied").map(c => c.compendium);
      const summary = copied.length > 0
        ? `installed ${copied.join(" + ")}`
        : "compendiums up-to-date";
      const legacy = result.legacySrdRemoved ? " (legacy SRD removed)" : "";
      n.setMessage(`Archivist: ${summary}${legacy}`);
      activeWindow.setTimeout(() => n.hide(), 3000);
      this.settings.srdImported = true;
      await this.saveSettings();
    } catch (err) {
      n.hide();
      console.error("Archivist: compendium bootstrap failed", err);
      new Notice("Archivist: compendium bootstrap failed; existing compendiums will still load.");
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
   * Register a markdown code-block processor for an entity presenter.
   *
   * Handles the shared scaffolding every entity presenter uses: initial view
   * render, side buttons (edit/save/compendium/delete/column-toggle), edit-mode
   * toggle, and save-to-compendium flow. Presenter-specific behavior (renderer,
   * edit-mode UI, whether the column toggle is shown) is supplied by the
   * presenter; parsing is the kernel's job (codec + resolve() below).
   */
  private registerEntityCodeBlock(presenter: EntityPresenter): void {
    const codeBlockType = presenter.type;
    const entityType = presenter.type;
    const supportsColumns = presenter.supportsColumns === true;
    const pres = presenter;

    // Render via the presenter. Returns the appended node so callers that
    // must swap it (column-toggle) can do so cheaply.
    const renderViaModule = (data: unknown, columns: number, doc: Document): HTMLElement | null => {
      const scratch = doc.createElement("div");
      const ctx: RenderContext = {
        plugin: this,
        ctx: null,
        ...(supportsColumns ? { columns } : {}),
      };
      const appended = pres.render(scratch, data, ctx);
      const node = appended ?? (scratch.lastElementChild as HTMLElement | null);
      if (node && node.parentElement === scratch) scratch.removeChild(node);
      return node;
    };

    this.registerMarkdownCodeBlockProcessor(codeBlockType, (source, el, ctx) => {
      // Kernel parse: behavior-identical to mod.parseYaml(source) — the legacy
      // adapter's doc.parse runs mod.parseYaml over doc.body (= source).
      const et = this.archivist.getEntityType(codeBlockType);
      // CODEC output feeds edit-mode + compendium-save (lossless, authored
      // structure only). The resolved output feeds the VIEW render (adds
      // light view-derived fields, e.g. monster proficiency_bonus). If
      // resolve throws/fails, view falls back to the codec data.
      const codecResult = et?.doc?.parse({ type: codeBlockType, frontmatter: {}, body: source, raw: source });
      if (!codecResult || !codecResult.success) {
        el.appendChild(createErrorBlock(codecResult ? codecResult.error : "no codec", source));
        return;
      }
      const resolvedResult = this.archivist.resolve({ type: codeBlockType, frontmatter: {}, body: source, raw: source });
      const viewData = resolvedResult.success ? resolvedResult.data : codecResult.data;

      let isEditMode = false;
      // `columns` only meaningful for modules that opt in; others pin to 1.
      // `columns` is an AUTHORED structural field — read from the codec.
      const initialColumns = supportsColumns
        ? ((codecResult.data as { columns?: number }).columns ?? 1)
        : 1;
      let columns = initialColumns;
      let rendered = renderViaModule(viewData, columns, el.doc);
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
        rendered = renderViaModule(viewData, columns, el.doc);
        if (rendered) el.insertBefore(rendered, sideBtns);
        sideBtns.removeClass("always-visible");
        updateSideButtons();
      };

      const enterEditMode = () => {
        isEditMode = true;
        // Clear view mode content
        rendered?.remove();
        sideBtns.addClass("always-visible");
        // Delegate to the presenter's edit-mode renderer. The presenter reads
        // `plugin` / `ctx` from the EditContext and invokes `onExit` when it
        // needs to restore the view-mode render without a content change
        // (e.g. cancel with no edits). Only monster/spell/item define it.
        pres.renderEditMode?.(el, codecResult.data, {
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
              comp.name, entityType, codecResult.data as Record<string, unknown>,
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
            const newRendered = renderViaModule(viewData, columns, el.doc);
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
