import { Plugin, Notice, setIcon } from "obsidian";

// D&D parsers
import { parseMonster } from "./modules/monster/monster.parser";
import { parseSpell } from "./modules/spell/spell.parser";
import { parseItem } from "./parsers/item-parser";
import { parseInlineTag } from "./shared/rendering/inline-tag-parser";

// D&D renderers
import { renderMonsterBlock } from "./modules/monster/monster.renderer";
import { renderSpellBlock } from "./modules/spell/spell.renderer";
import { renderItemBlock } from "./renderers/item-renderer";
import { renderInlineTag } from "./shared/rendering/inline-tag-renderer";
import { createErrorBlock } from "./shared/rendering/renderer-utils";

// Edit mode
import { renderSideButtons } from "./shared/edit/side-buttons";
import { renderMonsterEditMode } from "./modules/monster/edit/monster-edit-render";
import { renderSpellEditMode } from "./modules/spell/spell.edit-render";
import { renderItemEditMode } from "./edit/item-edit-render";

// D&D modals
import { MonsterModal } from "./modules/monster/monster.modal";
import { SpellModal } from "./modules/spell/spell.modal";
import { ItemModal } from "./modals/item-modal";

// D&D editor extension
import { inlineTagPlugin } from "./shared/extensions/inline-tag-extension";
import { dndBlockDeleteKeymap } from "./shared/extensions/dnd-block-delete-extension";
import { CompendiumEditorSuggest } from "./shared/extensions/compendium-suggest";
import { compendiumRefPlugin, setCompendiumRefRegistry, setCompendiumRefPlugin, parseCompendiumRef } from "./shared/extensions/compendium-ref-extension";
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

// Inquiry (Claudian chat engine)
import { InquiryModule } from "./inquiry/InquiryModule";

export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings = { ...DEFAULT_SETTINGS };
  entityRegistry: EntityRegistry | null = null;
  compendiumManager: CompendiumManager | null = null;
  inquiry: InquiryModule | null = null;
  private srdStore: SrdStore | null = null;

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

    // Initialize InquiryModule (Claudian chat engine)
    this.inquiry = new InquiryModule(this, this.app, this.entityRegistry, this.srdStore);
    await this.inquiry.init();

    // D&D code block processors
    this.registerMarkdownCodeBlockProcessor("monster", (source, el, ctx) => {
      const result = parseMonster(source);
      if (!result.success) {
        el.appendChild(createErrorBlock(result.error, source));
        return;
      }

      let isEditMode = false;
      let columns = result.data.columns ?? 1;
      let rendered = renderMonsterBlock(result.data, columns);
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
          editor.replaceRange('', { line: fromLine, ch: 0 }, { line: toLine + 1, ch: 0 });
          editor.setCursor({ line: fromLine, ch: 0 });
        } else {
          const endCh = editor.getLine(toLine).length;
          if (fromLine > 0) {
            const prevLineLen = editor.getLine(fromLine - 1).length;
            editor.replaceRange('', { line: fromLine - 1, ch: prevLineLen }, { line: toLine, ch: endCh });
            editor.setCursor({ line: fromLine - 1, ch: prevLineLen });
          } else {
            editor.replaceRange('', { line: fromLine, ch: 0 }, { line: toLine, ch: endCh });
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
        rendered = renderMonsterBlock(result.data, columns);
        el.insertBefore(rendered, sideBtns);
        sideBtns.removeClass("always-visible");
        updateSideButtons();
      };

      const updateSideButtons = () => {
        renderSideButtons(sideBtns, {
          state: isEditMode ? "editing" : "default",
          isColumnActive: columns === 2,
          onEdit: () => {
            if (isEditMode) {
              exitEditMode();
            } else {
              isEditMode = true;
              // Clear view mode content
              rendered.remove();
              sideBtns.addClass("always-visible");
              // Render edit mode
              renderMonsterEditMode(result.data, el, ctx, this, exitEditMode);
            }
          },
          onSave: () => {}, // handled by edit mode internally
          onSaveAsNew: () => {},
          onCompendium: () => {
            if (!this.compendiumManager) return;
            const writable = this.compendiumManager.getWritable();
            const saveToComp = async (comp: { name: string }) => {
              try {
                const registered = await this.compendiumManager!.saveEntity(
                  comp.name, "monster", result.data as unknown as Record<string, unknown>,
                );
                const sectionInfo = ctx.getSectionInfo(el);
                if (sectionInfo) {
                  const editor = this.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: sectionInfo.lineStart, ch: 0 };
                    const to = { line: sectionInfo.lineEnd, ch: editor.getLine(sectionInfo.lineEnd).length };
                    editor.replaceRange(`{{monster:${registered.slug}}}`, from, to);
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
          },
          onCancel: () => exitEditMode(),
          onDelete: deleteBlock,
          onColumnToggle: () => {
            columns = columns === 1 ? 2 : 1;
            const newRendered = renderMonsterBlock(result.data, columns);
            rendered.replaceWith(newRendered);
            rendered = newRendered;
            updateSideButtons();
          },
        });
      };
      updateSideButtons();
    });
    this.registerMarkdownCodeBlockProcessor("spell", (source, el, ctx) => {
      const result = parseSpell(source);
      if (!result.success) {
        el.appendChild(createErrorBlock(result.error, source));
        return;
      }

      let isEditMode = false;
      let rendered = renderSpellBlock(result.data);
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
        rendered = renderSpellBlock(result.data);
        el.insertBefore(rendered, sideBtns);
        sideBtns.removeClass("always-visible");
        updateSideButtons();
      };

      const updateSideButtons = () => {
        renderSideButtons(sideBtns, {
          state: isEditMode ? "editing" : "default",
          isColumnActive: false,
          showColumnToggle: false,
          onEdit: () => {
            if (isEditMode) {
              exitEditMode();
            } else {
              isEditMode = true;
              // Clear view mode content
              rendered.remove();
              sideBtns.addClass("always-visible");
              // Render edit mode
              renderSpellEditMode(result.data, el, ctx, this, exitEditMode);
            }
          },
          onSave: () => {}, // handled by edit mode internally
          onSaveAsNew: () => {},
          onCompendium: () => {
            if (!this.compendiumManager) return;
            const writable = this.compendiumManager.getWritable();
            const saveToComp = async (comp: { name: string }) => {
              try {
                const registered = await this.compendiumManager!.saveEntity(
                  comp.name, "spell", result.data as unknown as Record<string, unknown>,
                );
                const sectionInfo = ctx.getSectionInfo(el);
                if (sectionInfo) {
                  const editor = this.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: sectionInfo.lineStart, ch: 0 };
                    const to = { line: sectionInfo.lineEnd, ch: editor.getLine(sectionInfo.lineEnd).length };
                    editor.replaceRange(`{{spell:${registered.slug}}}`, from, to);
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
          },
          onCancel: () => exitEditMode(),
          onDelete: deleteBlock,
          onColumnToggle: () => {},
        });
      };
      updateSideButtons();
    });
    this.registerMarkdownCodeBlockProcessor("item", (source, el, ctx) => {
      const result = parseItem(source);
      if (!result.success) {
        el.appendChild(createErrorBlock(result.error, source));
        return;
      }

      let isEditMode = false;
      let rendered = renderItemBlock(result.data);
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
        rendered = renderItemBlock(result.data);
        el.insertBefore(rendered, sideBtns);
        sideBtns.removeClass("always-visible");
        updateSideButtons();
      };

      const updateSideButtons = () => {
        renderSideButtons(sideBtns, {
          state: isEditMode ? "editing" : "default",
          isColumnActive: false,
          showColumnToggle: false,
          onEdit: () => {
            if (isEditMode) {
              exitEditMode();
            } else {
              isEditMode = true;
              // Clear view mode content
              rendered.remove();
              sideBtns.addClass("always-visible");
              // Render edit mode
              renderItemEditMode(result.data, el, ctx, this, exitEditMode);
            }
          },
          onSave: () => {}, // handled by edit mode internally
          onSaveAsNew: () => {},
          onCompendium: () => {
            if (!this.compendiumManager) return;
            const writable = this.compendiumManager.getWritable();
            const saveToComp = async (comp: { name: string }) => {
              try {
                const registered = await this.compendiumManager!.saveEntity(
                  comp.name, "item", result.data as unknown as Record<string, unknown>,
                );
                const sectionInfo = ctx.getSectionInfo(el);
                if (sectionInfo) {
                  const editor = this.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: sectionInfo.lineStart, ch: 0 };
                    const to = { line: sectionInfo.lineEnd, ch: editor.getLine(sectionInfo.lineEnd).length };
                    editor.replaceRange(`{{item:${registered.slug}}}`, from, to);
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
          },
          onCancel: () => exitEditMode(),
          onDelete: deleteBlock,
          onColumnToggle: () => {},
        });
      };
      updateSideButtons();
    });

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

    // D&D insert commands
    this.addCommand({
      id: "insert-monster",
      name: "Insert monster block",
      editorCallback: (editor) => {
        new MonsterModal(this.app, editor).open();
      },
    });
    this.addCommand({
      id: "insert-spell",
      name: "Insert spell block",
      editorCallback: (editor) => {
        new SpellModal(this.app, editor).open();
      },
    });
    this.addCommand({
      id: "insert-item",
      name: "Insert magic item block",
      editorCallback: (editor) => {
        new ItemModal(this.app, editor).open();
      },
    });

    // Settings tab is registered by InquiryModule (unified D&D + Inquiry settings)

    // Initialize compendiums after vault index is ready (avoids race conditions
    // where getAbstractFileByPath returns null for folders that exist on disk)
    this.app.workspace.onLayoutReady(() => {
      void this.initializeCompendiums();
    });
  }

  onunload() {
    void this.inquiry?.destroy();
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

}
