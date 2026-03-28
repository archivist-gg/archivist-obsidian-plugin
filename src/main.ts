import { Plugin } from "obsidian";
import { parseMonster } from "./parsers/monster-parser";
import { parseSpell } from "./parsers/spell-parser";
import { parseItem } from "./parsers/item-parser";
import { parseInlineTag } from "./parsers/inline-tag-parser";
import { renderMonsterBlock } from "./renderers/monster-renderer";
import { renderSpellBlock } from "./renderers/spell-renderer";
import { renderItemBlock } from "./renderers/item-renderer";
import { renderInlineTag } from "./renderers/inline-tag-renderer";
import { createErrorBlock } from "./renderers/renderer-utils";
import { MonsterModal } from "./modals/monster-modal";
import { SpellModal } from "./modals/spell-modal";
import { ItemModal } from "./modals/item-modal";
import { inlineTagPlugin } from "./extensions/inline-tag-extension";
import { InquiryView, VIEW_TYPE_INQUIRY } from "./ui/inquiry-view";
import { ArchivistSettingTab } from "./settings/settings-tab";
import { AgentService } from "./ai/agent-service";
import { ConversationManager } from "./ai/conversation-manager";
import { SrdStore } from "./ai/srd/srd-store";
import type { ArchivistSettings } from "./types/settings";
import { DEFAULT_SETTINGS } from "./types/settings";

export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings = { ...DEFAULT_SETTINGS };
  agentService: AgentService | null = null;
  conversationManager: ConversationManager | null = null;
  private srdStore: SrdStore | null = null;

  async onload() {
    await this.loadSettings();

    // Initialize SRD store
    this.srdStore = new SrdStore();

    // Initialize AI services
    this.agentService = new AgentService(this.srdStore);
    this.conversationManager = new ConversationManager(
      async () => {
        const data = await this.loadData();
        return data?.conversationStore ?? null;
      },
      async (store) => {
        const data = (await this.loadData()) ?? {};
        data.conversationStore = store;
        await this.saveData(data);
      },
      this.settings.maxConversations,
    );
    await this.conversationManager.load();

    // Register the Inquiry view
    this.registerView(VIEW_TYPE_INQUIRY, (leaf) => new InquiryView(leaf, this));

    // Ribbon icon
    this.addRibbonIcon("bot", "Archivist Inquiry", () => this.activateInquiryView());

    // Command to open Inquiry
    this.addCommand({
      id: "open-inquiry",
      name: "Open Archivist Inquiry",
      callback: () => this.activateInquiryView(),
    });

    // Existing block processors
    this.registerMarkdownCodeBlockProcessor("monster", (source, el) =>
      this.renderBlock(source, el, parseMonster, renderMonsterBlock),
    );
    this.registerMarkdownCodeBlockProcessor("spell", (source, el) =>
      this.renderBlock(source, el, parseSpell, renderSpellBlock),
    );
    this.registerMarkdownCodeBlockProcessor("item", (source, el) =>
      this.renderBlock(source, el, parseItem, renderItemBlock),
    );

    // Existing post-processor
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

    // Existing editor extension
    this.registerEditorExtension(inlineTagPlugin);

    // Existing commands
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

    // Settings tab
    this.addSettingTab(new ArchivistSettingTab(this.app, this));
  }

  private async activateInquiryView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_INQUIRY);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_INQUIRY, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  private renderBlock<T>(
    source: string,
    el: HTMLElement,
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

  onunload() {
    this.agentService?.abort();
  }
}
