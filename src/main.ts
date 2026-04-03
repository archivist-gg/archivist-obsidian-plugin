import { Plugin, Notice } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";

// D&D parsers
import { parseMonster } from "./parsers/monster-parser";
import { parseSpell } from "./parsers/spell-parser";
import { parseItem } from "./parsers/item-parser";
import { parseInlineTag } from "./parsers/inline-tag-parser";

// D&D renderers
import { renderMonsterBlock } from "./renderers/monster-renderer";
import { renderSpellBlock } from "./renderers/spell-renderer";
import { renderItemBlock } from "./renderers/item-renderer";
import { renderInlineTag } from "./renderers/inline-tag-renderer";
import { createErrorBlock } from "./renderers/renderer-utils";

// Edit mode
import { renderSideButtons } from "./edit/side-buttons";
import { renderMonsterEditMode } from "./edit/monster-edit-render";
import { renderSpellEditMode } from "./edit/spell-edit-render";
import { renderItemEditMode } from "./edit/item-edit-render";

// D&D modals
import { MonsterModal } from "./modals/monster-modal";
import { SpellModal } from "./modals/spell-modal";
import { ItemModal } from "./modals/item-modal";

// D&D editor extension
import { inlineTagPlugin } from "./extensions/inline-tag-extension";
import { dndBlockDeleteKeymap } from "./extensions/dnd-block-delete-extension";
import { EntityEditorSuggest } from "./extensions/entity-editor-suggest";

// SRD & entities
import { SrdStore } from "./ai/srd/srd-store";
import { EntityRegistry } from "./entities/entity-registry";
import { importSrdToVault } from "./entities/entity-importer";
import { parseEntityFrontmatter, TYPE_FOLDER_MAP } from "./entities/entity-vault-store";

// Settings
import type { ArchivistSettings } from "./types/settings";
import { DEFAULT_SETTINGS } from "./types/settings";

// Inquiry (Claudian chat engine)
import { InquiryModule } from "./inquiry/InquiryModule";

export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings = { ...DEFAULT_SETTINGS };
  entityRegistry: EntityRegistry | null = null;
  inquiry: InquiryModule | null = null;
  private srdStore: SrdStore | null = null;

  async onload() {
    await this.loadSettings();

    // Initialize SRD store with bundled JSON data
    this.srdStore = new SrdStore();
    this.srdStore.loadFromBundledJson();

    // Initialize entity registry and populate from SRD store
    this.entityRegistry = new EntityRegistry();
    for (const entityType of this.srdStore.getTypes()) {
      for (const srdEntity of this.srdStore.getAllOfType(entityType)) {
        const folder = TYPE_FOLDER_MAP[srdEntity.entityType] ?? srdEntity.entityType;
        this.entityRegistry.register({
          slug: srdEntity.slug,
          name: srdEntity.name,
          entityType: srdEntity.entityType,
          source: "srd",
          filePath: `${this.settings.compendiumRoot}/SRD/${folder}/${srdEntity.name}.md`,
          data: srdEntity.data,
        });
      }
    }

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
          onCompendium: () => {},
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
          onCompendium: () => {},
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
          onCompendium: () => {},
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

    // CodeMirror editor extension
    this.registerEditorExtension(inlineTagPlugin);
    this.registerEditorExtension(dndBlockDeleteKeymap);

    // Editor entity suggest ([[monster:, [[spell:, [[item:, [[feat:)
    this.registerEditorSuggest(new EntityEditorSuggest(this.app, this.srdStore!));

    // D&D insert commands
    this.addCommand({
      id: "insert-monster",
      name: "Insert Monster Block",
      editorCallback: (editor) => {
        new MonsterModal(this.app, editor).open();
      },
    });
    this.addCommand({
      id: "insert-spell",
      name: "Insert Spell Block",
      editorCallback: (editor) => {
        new SpellModal(this.app, editor).open();
      },
    });
    this.addCommand({
      id: "insert-item",
      name: "Insert Magic Item Block",
      editorCallback: (editor) => {
        new ItemModal(this.app, editor).open();
      },
    });

    // Settings tab is registered by InquiryModule (unified D&D + Inquiry settings)

    // First-load SRD import (async, non-blocking)
    this.triggerSrdImport();
  }

  async onunload() {
    await this.inquiry?.destroy();
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
  }

  async saveSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    data.settings = this.settings;
    await this.saveData(data);
  }

  private triggerSrdImport(): void {
    if (!this.settings.srdImported) {
      const notice = new Notice("Importing SRD content...", 0);
      importSrdToVault(
        this.app.vault,
        this.srdStore!,
        this.settings.compendiumRoot,
        (current, total) => {
          notice.setMessage(`Importing SRD content... ${current}/${total}`);
        },
      ).then(async (count) => {
        notice.hide();
        new Notice(`SRD import complete. ${count} entities added to vault.`);
        this.settings.srdImported = true;
        await this.saveSettings();
        await this.loadUserEntities();
      }).catch((err) => {
        notice.hide();
        new Notice(`SRD import failed: ${err.message}`);
        console.error("SRD import failed:", err);
      });
    } else {
      this.loadUserEntities();
    }
  }

  private async loadUserEntities(): Promise<void> {
    if (!this.entityRegistry) return;
    const userRoot = `${this.settings.compendiumRoot}/${this.settings.userEntityFolder}`;
    const files = this.app.vault.getMarkdownFiles()
      .filter((f: { path: string }) => f.path.startsWith(userRoot));

    for (const file of files) {
      try {
        const content = await this.app.vault.cachedRead(file);
        const entity = parseEntityFrontmatter(content);
        if (entity) {
          this.entityRegistry.register({
            ...entity,
            source: "custom",
            filePath: file.path,
          });
        }
      } catch { /* skip unreadable files */ }
    }
  }

}
