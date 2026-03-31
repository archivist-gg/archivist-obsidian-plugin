import { Plugin, Notice, setIcon } from "obsidian";
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

// D&D modals
import { MonsterModal } from "./modals/monster-modal";
import { SpellModal } from "./modals/spell-modal";
import { ItemModal } from "./modals/item-modal";

// D&D editor extension
import { inlineTagPlugin } from "./extensions/inline-tag-extension";
import { dndBlockDeleteKeymap } from "./extensions/dnd-block-delete-extension";
import { EntityEditorSuggest } from "./extensions/entity-editor-suggest";

// Dice overlay
import { DiceOverlay } from "./dice";

// SRD & entities
import { SrdStore } from "./ai/srd/srd-store";
import { EntityRegistry } from "./entities/entity-registry";
import { importSrdToVault } from "./entities/entity-importer";
import { parseEntityFrontmatter, TYPE_FOLDER_MAP } from "./entities/entity-vault-store";

// Settings
import { ArchivistSettingTab } from "./settings/settings-tab";
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
    this.registerMarkdownCodeBlockProcessor("monster", (source, el, ctx) =>
      this.renderBlock(source, el, ctx, parseMonster, renderMonsterBlock),
    );
    this.registerMarkdownCodeBlockProcessor("spell", (source, el, ctx) =>
      this.renderBlock(source, el, ctx, parseSpell, renderSpellBlock),
    );
    this.registerMarkdownCodeBlockProcessor("item", (source, el, ctx) =>
      this.renderBlock(source, el, ctx, parseItem, renderItemBlock),
    );

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

    // Dice overlay -- catches archivist-dice-roll events from annotation clicks
    const diceOverlay = new DiceOverlay();
    this.registerDomEvent(document, 'archivist-dice-roll' as any, (e: CustomEvent) => {
      const { notation } = e.detail;
      if (notation) diceOverlay.roll3D(notation);
    });

    // Lazy-init 3D dice (non-blocking -- falls back to math if it fails)
    // DiceBox fetches assets via fetch(origin + assetPath + ...) -- in Electron we need file:// URLs
    const vaultAdapter = this.app.vault.adapter as any;
    const vaultPluginDir = `${vaultAdapter.basePath}/${this.app.vault.configDir}/plugins/archivist-ttrpg-blocks`;
    const diceAssetPath = `file://${vaultPluginDir}/assets/dice-box/`;
    diceOverlay.initialize3D(diceAssetPath);

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

    // D&D settings tab
    this.addSettingTab(new ArchivistSettingTab(this.app, this));

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

  private renderBlock<T>(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    parser: (
      source: string,
    ) => { success: true; data: T } | { success: false; error: string },
    renderer: (data: T) => HTMLElement,
  ): void {
    const result = parser(source);
    if (result.success) {
      el.appendChild(renderer(result.data));
    } else {
      el.appendChild(createErrorBlock(result.error, source));
    }

    // Add delete button (trash icon) — appears below Obsidian's </> button
    const deleteBtn = el.createDiv({ cls: 'archivist-block-delete-btn' });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.setAttribute('aria-label', 'Delete block');
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const info = ctx.getSectionInfo(el);
      if (!info) return;
      const editor = this.app.workspace.activeEditor?.editor;
      if (!editor) return;
      const fromLine = info.lineStart;
      const toLine = info.lineEnd;
      const totalLines = editor.lineCount();
      if (toLine + 1 < totalLines) {
        editor.replaceRange('', { line: fromLine, ch: 0 }, { line: toLine + 1, ch: 0 });
        // Keep cursor at the delete position to prevent scroll jump
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
    });
  }
}
