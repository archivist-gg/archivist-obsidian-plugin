import { ItemView, WorkspaceLeaf, MarkdownView } from "obsidian";
import { renderChatHeader } from "./components/chat-header";
import { renderChatTabs, type TabData } from "./components/chat-tabs";
import { renderChatMessages } from "./components/chat-messages";
import { renderChatInput, type ChatInputState } from "./components/chat-input";
import { renderChatHistory } from "./components/chat-history";
import type { Message } from "../types/conversation";
import type { StreamEvent } from "../ai/agent-service";
import type { AgentService } from "../ai/agent-service";
import type { ConversationManager } from "../ai/conversation-manager";
import type { ArchivistSettings } from "../types/settings";

export const VIEW_TYPE_INQUIRY = "archivist-inquiry-view";

// Use an interface for the plugin to avoid circular dependency with main.ts
interface ArchivistPluginRef {
  settings: ArchivistSettings;
  conversationManager: ConversationManager | null;
  agentService: AgentService | null;
  saveSettings(): Promise<void>;
  app: any;
}

export class InquiryView extends ItemView {
  pluginRef: ArchivistPluginRef;
  private root: HTMLElement | null = null;
  private historyVisible = false;
  private isStreaming = false;
  private selectedText: string | undefined;

  constructor(leaf: WorkspaceLeaf, pluginRef: ArchivistPluginRef) {
    super(leaf);
    this.pluginRef = pluginRef;
  }

  getViewType(): string { return VIEW_TYPE_INQUIRY; }
  getDisplayText(): string { return "Archivist Inquiry"; }
  getIcon(): string { return "bot"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("archivist-inquiry-container");
    this.root = container;
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateSelection()));
    this.render();
  }

  async onClose(): Promise<void> {
    this.pluginRef.agentService?.abort();
  }

  updateSelection(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor) {
      this.selectedText = view.editor.getSelection() || undefined;
    } else {
      this.selectedText = undefined;
    }
  }

  render(): void {
    if (!this.root) return;
    this.root.empty();
    const mgr = this.pluginRef.conversationManager;
    if (!mgr) return;

    // Header
    renderChatHeader(this.root, {
      onNewChat: () => this.createNewChat(),
      onToggleHistory: () => {
        this.historyVisible = !this.historyVisible;
        this.render();
      },
      onClose: () => this.app.workspace.detachLeavesOfType(VIEW_TYPE_INQUIRY),
    });

    // Tabs
    const openTabs = mgr.getOpenTabs();
    const activeId = mgr.getActiveConversationId();
    const tabData: TabData[] = openTabs.map((id) => {
      const conv = mgr.getConversation(id);
      return { id, title: conv?.title ?? "Untitled", isActive: id === activeId };
    });
    if (tabData.length > 0) {
      renderChatTabs(this.root, tabData, {
        onSelectTab: (id) => { mgr.setActiveTab(id); this.render(); },
        onCloseTab: (id) => { mgr.closeTab(id); this.render(); },
        onCloseOtherTabs: (id) => {
          for (const t of openTabs) if (t !== id) mgr.closeTab(t);
          this.render();
        },
        onCloseAllTabs: () => {
          for (const t of openTabs) mgr.closeTab(t);
          this.render();
        },
      });
    }

    // Messages
    const activeConv = activeId ? mgr.getConversation(activeId) : undefined;
    const messages = activeConv?.messages ?? [];
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    renderChatMessages(this.root, messages, this.app, sourcePath, this.isStreaming);

    // Input
    const inputState: ChatInputState = {
      selectedText: this.selectedText,
      model: activeConv?.model ?? this.pluginRef.settings.defaultModel,
      permissionMode: this.pluginRef.settings.permissionMode,
      contextPercent: 0,
      isStreaming: this.isStreaming,
    };
    renderChatInput(this.root, inputState, {
      onSend: (text) => this.sendMessage(text),
      onStop: () => this.pluginRef.agentService?.abort(),
      onModelChange: (model) => {
        if (activeConv) activeConv.model = model;
        this.render();
      },
      onPermissionToggle: async () => {
        this.pluginRef.settings.permissionMode =
          this.pluginRef.settings.permissionMode === "auto" ? "safe" : "auto";
        await this.pluginRef.saveSettings();
        this.render();
      },
      onDismissSelection: () => {
        this.selectedText = undefined;
        this.render();
      },
    });

    // History
    if (this.historyVisible) {
      renderChatHistory(this.root, mgr.listConversations(), activeId, {
        onSelectConversation: (id) => {
          mgr.openTab(id);
          this.historyVisible = false;
          this.render();
        },
        onDeleteConversation: async (id) => {
          await mgr.deleteConversation(id);
          this.render();
        },
      });
    }
  }

  private async createNewChat(): Promise<void> {
    const mgr = this.pluginRef.conversationManager;
    if (!mgr) return;
    const conv = await mgr.createConversation(this.pluginRef.settings.defaultModel);
    mgr.openTab(conv.id);
    this.render();
  }

  private async sendMessage(text: string): Promise<void> {
    const mgr = this.pluginRef.conversationManager;
    const agent = this.pluginRef.agentService;
    if (!mgr || !agent) return;

    let activeId = mgr.getActiveConversationId();
    if (!activeId) {
      const conv = await mgr.createConversation(this.pluginRef.settings.defaultModel);
      mgr.openTab(conv.id);
      activeId = conv.id;
    }

    await mgr.addMessage(activeId, {
      id: "msg-" + Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });

    this.isStreaming = true;
    this.render();

    const activeFile = this.app.workspace.getActiveFile();
    let currentNoteContent: string | undefined;
    if (activeFile) {
      try {
        currentNoteContent = await this.app.vault.cachedRead(activeFile);
      } catch { /* ignore read errors */ }
    }

    const vaultPath = (this.app.vault.adapter as any).basePath ?? "";
    const ttrpgRoot = this.pluginRef.settings.ttrpgRootDir === "/"
      ? vaultPath
      : `${vaultPath}/${this.pluginRef.settings.ttrpgRootDir}`;

    const context = {
      ttrpgRootDir: ttrpgRoot,
      currentNotePath: activeFile?.path,
      currentNoteContent,
      selectedText: this.selectedText,
    };

    const conv = mgr.getConversation(activeId);
    const model = conv?.model ?? this.pluginRef.settings.defaultModel;

    let assistantContent = "";
    let generatedEntity: Message["generatedEntity"] | undefined;

    try {
      for await (const event of agent.sendMessage(text, this.pluginRef.settings, context, model)) {
        if (event.type === "text") {
          assistantContent += event.content ?? "";
          this.render();
        } else if (event.type === "error") {
          assistantContent += `\n\n**Error:** ${event.content}`;
        }
        // Check for generated entity
        if (event.type === "text" && event.content) {
          try {
            const parsed = JSON.parse(event.content);
            if (parsed.type && parsed.data) {
              generatedEntity = { type: parsed.type, data: parsed.data };
            }
          } catch { /* not JSON, ignore */ }
        }
      }
    } catch (err) {
      assistantContent += `\n\n**Error:** ${(err as Error).message}`;
    }

    await mgr.addMessage(activeId, {
      id: "msg-" + Date.now().toString(36),
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
      generatedEntity,
    });

    this.isStreaming = false;
    this.render();
  }
}
