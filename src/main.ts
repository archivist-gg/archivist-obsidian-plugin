import { Plugin, Notice, setIcon, type MarkdownPostProcessorContext } from "obsidian";

// Module-based registration
import type {
  AIToolDefinition,
  AIToolRegistry,
  ArchivistModule,
  CoreAPI,
} from "./core/module-api";
import { ModuleRegistry } from "./core/module-registry";
import { monsterModule } from "./modules/monster/monster.module";
import { spellModule } from "./modules/spell/spell.module";
import { itemModule } from "./modules/item/item.module";
import { npcModule } from "./modules/npc/npc.module";
import { encounterModule } from "./modules/encounter/encounter.module";
import { InquiryArchivistModule } from "./modules/inquiry/inquiry.module";

// Per-entity parsers + renderers kept for the column-toggle re-render path
// and the Reading-mode compendium-ref post-processor (both need direct access
// to renderer outputs; the ArchivistModule.render method appends into an
// element rather than returning the rendered node, so the column-toggle path
// which must swap the rendered node in place uses these directly).
// TODO(phase0-task13): flow these through the module API so main.ts doesn't
// need per-type imports.
import { parseMonster } from "./modules/monster/monster.parser";
import { parseSpell } from "./modules/spell/spell.parser";
import { parseItem } from "./modules/item/item.parser";
import { renderMonsterBlock } from "./modules/monster/monster.renderer";
import { renderSpellBlock } from "./modules/spell/spell.renderer";
import { renderItemBlock } from "./modules/item/item.renderer";

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
  parseCompendiumRef,
} from "./shared/extensions/compendium-ref-extension";
import * as yaml from "js-yaml";

// SRD & entities
import { SrdStore } from "./shared/ai/srd-store";
import { EntityRegistry } from "./shared/entities/entity-registry";
import { importSrdToVault } from "./shared/entities/entity-importer";
import { CompendiumManager } from "./shared/entities/compendium-manager";
import { CompendiumSelectModal, CreateCompendiumModal } from "./shared/entities/compendium-modal";

// Settings
import type { ArchivistSettings } from "./core/plugin-settings";
import { DEFAULT_SETTINGS } from "./core/plugin-settings";

// Inquiry (Claudian chat engine) — type only; instance is created by the
// InquiryArchivistModule wrapper during its register() call.
import type { InquiryModule } from "./modules/inquiry/InquiryModule";

/**
 * Simple in-memory AI tool registry. Modules push their tool definitions into
 * this during `register()`; downstream consumers (e.g. the MCP server wiring)
 * will migrate to reading from here in a follow-up task.
 *
 * TODO(phase0-task13): wire `createArchivistMcpServer` to consume the tools
 * collected here instead of importing each module's tool directly.
 */
function createAIToolRegistry(): AIToolRegistry & { getAll(): AIToolDefinition[] } {
  const tools: AIToolDefinition[] = [];
  return {
    register(toolDef: AIToolDefinition): void {
      tools.push(toolDef);
    },
    getAll(): AIToolDefinition[] {
      return tools.slice();
    },
  };
}

type EntityBlockRenderer = (data: unknown, columns: number) => HTMLElement;

/** Per-entity-type renderer lookup for the code-block processor. */
const ENTITY_BLOCK_RENDERERS: Record<string, EntityBlockRenderer> = {
  monster: (data, columns) => renderMonsterBlock(data as Parameters<typeof renderMonsterBlock>[0], columns),
  spell: (data) => renderSpellBlock(data as Parameters<typeof renderSpellBlock>[0]),
  item: (data) => renderItemBlock(data as Parameters<typeof renderItemBlock>[0]),
};

export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings = { ...DEFAULT_SETTINGS };
  entityRegistry: EntityRegistry | null = null;
  compendiumManager: CompendiumManager | null = null;
  inquiry: InquiryModule | null = null;
  private srdStore: SrdStore | null = null;
  private moduleList: ArchivistModule[] = [];
  private core: CoreAPI | null = null;

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
    ];

    for (const mod of this.moduleList) {
      moduleRegistry.register(mod);
      mod.register(this.core);
      if (mod.registerAITools) {
        mod.registerAITools(aiToolRegistry);
      }
    }

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

    // Compendium ref post-processor for Reading mode ({{type:slug}} -> rendered stat block)
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
            const entity = this.entityRegistry.getBySlug(ref.slug);
            const typeMatches = !ref.entityType || entity.entityType === ref.entityType;
            if (entity && typeMatches) {
              const yamlStr = yaml.dump(entity.data, { lineWidth: -1, noRefs: true, sortKeys: false });
              const wrapper = doc.createElement("div");
              wrapper.classList.add("archivist-compendium-ref");
              let blockRendered: HTMLElement | null = null;
              switch (entity.entityType) {
                case "monster": {
                  const r = parseMonster(yamlStr);
                  if (r.success) blockRendered = renderMonsterBlock(r.data);
                  break;
                }
                case "spell": {
                  const r = parseSpell(yamlStr);
                  if (r.success) blockRendered = renderSpellBlock(r.data);
                  break;
                }
                case "item": {
                  const r = parseItem(yamlStr);
                  if (r.success) blockRendered = renderItemBlock(r.data);
                  break;
                }
              }
              if (blockRendered) {
                const badge = doc.createElement("div");
                badge.classList.add("archivist-compendium-badge");
                badge.textContent = entity.compendium;
                blockRendered.prepend(badge);
                wrapper.appendChild(blockRendered);
              }
              frag.appendChild(wrapper);
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
          // ModalConstructor widens trailing args to `...unknown[]`; in
          // practice every insert modal takes `(app, editor)`. The returned
          // instance is typed as `unknown`, so narrow to the minimal shape
          // needed to call `.open()`.
          const modal = new ModalCtor(this.app, editor) as { open: () => void };
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

  async onunload() {
    for (const mod of this.moduleList) {
      await mod.destroy?.();
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
    if (!codeBlockType || !entityType || !mod.parseYaml) return;

    const renderBlock = ENTITY_BLOCK_RENDERERS[codeBlockType];
    if (!renderBlock) {
      console.warn(`Archivist: no block renderer registered for "${codeBlockType}"`);
      return;
    }
    const supportsColumns = codeBlockType === "monster";

    this.registerMarkdownCodeBlockProcessor(codeBlockType, (source, el, ctx) => {
      const result = mod.parseYaml!(source);
      if (!result.success) {
        el.appendChild(createErrorBlock(result.error, source));
        return;
      }

      let isEditMode = false;
      // `columns` only meaningful for monsters; for spell/item we keep it at 1.
      const initialColumns = supportsColumns
        ? ((result.data as { columns?: number }).columns ?? 1)
        : 1;
      let columns = initialColumns;
      let rendered = renderBlock(result.data, columns);
      el.appendChild(rendered);

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
        rendered = renderBlock(result.data, columns);
        el.insertBefore(rendered, sideBtns);
        sideBtns.removeClass("always-visible");
        updateSideButtons();
      };

      const enterEditMode = () => {
        isEditMode = true;
        // Clear view mode content
        rendered.remove();
        sideBtns.addClass("always-visible");
        // Delegate to the module's edit-mode renderer. The modules read
        // `plugin` / `ctx` from the EditContext and invoke `onExit` when
        // they need to restore the view-mode render without a content
        // change (e.g. cancel with no edits).
        mod.renderEditMode?.(el, result.data, {
          plugin: this,
          ctx: ctx as MarkdownPostProcessorContext,
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
              comp.name, entityType, result.data as unknown as Record<string, unknown>,
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
            const newRendered = renderBlock(result.data, columns);
            rendered.replaceWith(newRendered);
            rendered = newRendered;
            updateSideButtons();
          },
        });
      };
      updateSideButtons();
    });
  }
}
