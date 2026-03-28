import { ItemView, WorkspaceLeaf, MarkdownView, MarkdownRenderer } from "obsidian";
import { renderChatHeader } from "./components/chat-header";
import { renderChatTabs, type TabData } from "./components/chat-tabs";
import { renderChatMessages } from "./components/chat-messages";
import { renderChatInput, type ChatInputState } from "./components/chat-input";
import { renderChatHistory } from "./components/chat-history";
import {
  renderUserMessage,
  renderThinkingBlock,
  renderToolCallBlock,
  renderResponseFooter,
  renderErrorMessage,
  type ThinkingBlockHandle,
  type ToolCallBlockHandle,
} from "./components/message-renderer";
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
      onModelChange: async (model) => {
        // Update active conversation's model in memory
        if (activeConv) activeConv.model = model;
        // Persist as default for new conversations
        this.pluginRef.settings.defaultModel = model;
        await this.pluginRef.saveSettings();
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
    // Full render to show user message and set up streaming state
    this.render();

    // Grab DOM references for incremental updates
    const messagesContainer = this.root?.querySelector(".archivist-inquiry-messages") as HTMLElement | null;
    if (!messagesContainer) return;

    // Remove the old thinking indicator that render() added (it's the simple "Thinking..." one)
    const oldIndicator = messagesContainer.querySelector(".archivist-inquiry-thinking");
    if (oldIndicator) oldIndicator.remove();

    // Create streaming container within the messages area
    const streamContainer = messagesContainer.createDiv({ cls: "archivist-inquiry-msg-assistant archivist-inquiry-streaming-session" });
    const textDiv = streamContainer.createDiv({ cls: "archivist-inquiry-msg-text" });

    const activeFile = this.app.workspace.getActiveFile();
    let currentNoteContent: string | undefined;
    if (activeFile) {
      try {
        currentNoteContent = await this.app.vault.cachedRead(activeFile);
      } catch { /* ignore read errors */ }
    }

    const adapter = this.app.vault.adapter as any;
    const vaultPath: string = adapter.getBasePath?.() ?? adapter.basePath ?? process.cwd();
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
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";

    // Streaming state
    let assistantContent = "";
    let generatedEntity: Message["generatedEntity"] | undefined;
    let currentThinkingBlock: ThinkingBlockHandle | null = null;
    const toolCallBlocks = new Map<string, ToolCallBlockHandle>();
    // Track the latest tool call ID for associating results when toolCallId is missing
    let lastToolCallId: string | undefined;

    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    };

    const renderTextContent = () => {
      if (!assistantContent) return;
      textDiv.empty();
      MarkdownRenderer.render(this.app, assistantContent, textDiv, sourcePath, null as any);
    };

    try {
      for await (const event of agent.sendMessage(text, this.pluginRef.settings, context, model)) {
        switch (event.type) {
          case "text_delta": {
            assistantContent += event.content ?? "";
            renderTextContent();
            scrollToBottom();
            break;
          }

          case "thinking_start": {
            currentThinkingBlock = renderThinkingBlock(streamContainer, this.app, sourcePath);
            // Insert thinking block before the text div
            streamContainer.insertBefore(currentThinkingBlock.el, textDiv);
            scrollToBottom();
            break;
          }

          case "thinking_delta": {
            if (currentThinkingBlock) {
              currentThinkingBlock.appendContent(event.content ?? "");
              scrollToBottom();
            }
            break;
          }

          case "thinking_end": {
            if (currentThinkingBlock) {
              currentThinkingBlock.finalize();
              currentThinkingBlock = null;
            }
            break;
          }

          case "tool_call_start": {
            const toolId = event.toolCallId ?? `tool-${Date.now()}`;
            lastToolCallId = toolId;
            const block = renderToolCallBlock(streamContainer, event.toolName ?? "unknown", toolId);
            if (event.toolInput) {
              block.setSummary(event.toolInput);
            }
            toolCallBlocks.set(toolId, block);
            // Insert tool block before the text div
            streamContainer.insertBefore(block.el, textDiv);
            scrollToBottom();
            break;
          }

          case "tool_call_end": {
            const toolId = event.toolCallId ?? lastToolCallId;
            if (toolId) {
              const block = toolCallBlocks.get(toolId);
              if (block && event.toolInput) {
                block.setSummary(event.toolInput);
              }
            }
            break;
          }

          case "tool_result": {
            const toolId = event.toolCallId ?? lastToolCallId;
            if (toolId) {
              const block = toolCallBlocks.get(toolId);
              if (block) {
                block.setResult(event.toolResult ?? "", event.isError === true);
                block.setStatus(event.isError ? "error" : "completed");
              }
            }
            scrollToBottom();
            break;
          }

          case "error": {
            renderErrorMessage(streamContainer, event.content ?? "Unknown error");
            assistantContent += `\n\n**Error:** ${event.content}`;
            scrollToBottom();
            break;
          }

          case "done": {
            if (event.durationMs) {
              renderResponseFooter(streamContainer, event.durationMs);
            }
            scrollToBottom();
            break;
          }
        }

        // Check for generated entity in text content
        if (event.type === "text_delta" && event.content) {
          try {
            const parsed = JSON.parse(assistantContent);
            if (parsed.type && parsed.data) {
              generatedEntity = { type: parsed.type, data: parsed.data };
            }
          } catch { /* not JSON, ignore */ }
        }
      }
    } catch (err) {
      assistantContent += `\n\n**Error:** ${(err as Error).message}`;
      renderErrorMessage(streamContainer, (err as Error).message);
    }

    // Finalize any open thinking block
    if (currentThinkingBlock) {
      currentThinkingBlock.finalize();
    }

    // Save the final assistant message
    await mgr.addMessage(activeId, {
      id: "msg-" + Date.now().toString(36),
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
      generatedEntity,
    });

    this.isStreaming = false;
    // Do NOT do a full re-render here -- the streaming session already built the DOM.
    // Just update the input area to reflect non-streaming state.
    this.updateInputArea();
  }

  /** Lightweight update of just the input area without full re-render */
  private updateInputArea(): void {
    if (!this.root) return;
    const mgr = this.pluginRef.conversationManager;
    if (!mgr) return;

    const activeId = mgr.getActiveConversationId();
    const activeConv = activeId ? mgr.getConversation(activeId) : undefined;

    // Remove old input area and re-render it
    const oldInput = this.root.querySelector(".archivist-inquiry-input-area");
    if (oldInput) oldInput.remove();

    const inputState: ChatInputState = {
      selectedText: this.selectedText,
      model: activeConv?.model ?? this.pluginRef.settings.defaultModel,
      permissionMode: this.pluginRef.settings.permissionMode,
      contextPercent: 0,
      isStreaming: false,
    };
    renderChatInput(this.root, inputState, {
      onSend: (text) => this.sendMessage(text),
      onStop: () => this.pluginRef.agentService?.abort(),
      onModelChange: async (model) => {
        if (activeConv) activeConv.model = model;
        this.pluginRef.settings.defaultModel = model;
        await this.pluginRef.saveSettings();
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
  }
}
