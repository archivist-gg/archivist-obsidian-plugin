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
  renderGeneratedBlock,
  renderBlockSkeleton,
  type ThinkingBlockHandle,
  type ToolCallBlockHandle,
  type GeneratedBlockHandle,
} from "./components/message-renderer";
import { enhanceCodeBlocks } from "./components/code-block-enhancer";
import type { Message, ContentBlock } from "../types/conversation";
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
  private noteIncluded = true;
  private mentionedFiles: string[] = [];
  /** DOM cache: conversation ID -> messages container element (survives tab switches) */
  private tabContainers = new Map<string, HTMLElement>();
  /** Per-tab context usage percentage */
  private tabContextPercent = new Map<string, number>();
  /** Per-tab streaming state for tab badges */
  private tabStreamingState = new Map<string, "idle" | "streaming" | "done">();

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
    this.tabContainers.clear();
    this.tabContextPercent.clear();
    this.tabStreamingState.clear();
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
    const mgr = this.pluginRef.conversationManager;
    if (!mgr) return;

    // Detach all cached message containers BEFORE clearing root
    // (so they survive the DOM wipe and can be re-attached)
    for (const el of this.tabContainers.values()) {
      el.remove();
    }

    this.root.empty();

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
      return { id, title: conv?.title ?? "Untitled", isActive: id === activeId, state: this.tabStreamingState.get(id) ?? "idle" };
    });
    if (tabData.length > 0) {
      renderChatTabs(this.root, tabData, {
        onSelectTab: async (id) => { await mgr.setActiveTab(id); this.render(); },
        onCloseTab: async (id) => {
          this.tabContainers.delete(id);
          this.tabContextPercent.delete(id);
          this.tabStreamingState.delete(id);
          await mgr.closeTab(id);
          this.render();
        },
        onCloseOtherTabs: async (id) => {
          for (const t of openTabs) {
            if (t !== id) {
              this.tabContainers.delete(t);
              this.tabContextPercent.delete(t);
              this.tabStreamingState.delete(t);
              await mgr.closeTab(t);
            }
          }
          this.render();
        },
        onCloseAllTabs: async () => {
          this.tabContainers.clear();
          this.tabContextPercent.clear();
          this.tabStreamingState.clear();
          for (const t of openTabs) await mgr.closeTab(t);
          this.render();
        },
      });
    }

    // Messages -- reuse cached DOM when available (like Claudian's hide/show approach)
    const activeConv = activeId ? mgr.getConversation(activeId) : undefined;
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";

    const chatCallbacks = {
      onRewind: async (messageId: string) => {
        if (!activeId) return;
        await mgr.rewindToMessage(activeId, messageId);
        this.tabContainers.delete(activeId); // Clear cached DOM to force re-render
        this.render();
      },
      onFork: async (messageId: string) => {
        if (!activeId) return;
        const conv = mgr.getConversation(activeId);
        const forked = await mgr.forkConversation(activeId, messageId, conv?.model ?? this.pluginRef.settings.defaultModel);
        if (forked) {
          await mgr.openTab(forked.id);
          this.render();
        }
      },
    };

    if (activeId && this.tabContainers.has(activeId)) {
      // Re-attach the cached messages container (preserves exact streaming DOM)
      const cached = this.tabContainers.get(activeId)!;
      this.root.appendChild(cached);
      requestAnimationFrame(() => { cached.scrollTop = cached.scrollHeight; });
    } else {
      // No cache -- render from saved data (first load, history open, or after restart)
      const messages = activeConv?.messages ?? [];
      const el = renderChatMessages(this.root, messages, this.app, sourcePath, this.isStreaming, chatCallbacks);
      if (activeId) {
        this.tabContainers.set(activeId, el);
      }
    }

    // Prune caches for conversations no longer in open tabs
    for (const id of this.tabContainers.keys()) {
      if (!openTabs.includes(id)) {
        this.tabContainers.delete(id);
        this.tabContextPercent.delete(id);
        this.tabStreamingState.delete(id);
      }
    }

    // Input -- use per-tab context percent
    const contextPercent = activeId ? (this.tabContextPercent.get(activeId) ?? 0) : 0;
    const vaultFiles = this.app.vault.getMarkdownFiles().map(f => f.path);
    const inputState: ChatInputState = {
      selectedText: this.selectedText,
      currentNotePath: this.noteIncluded ? (this.app.workspace.getActiveFile()?.path) : undefined,
      model: activeConv?.model ?? this.pluginRef.settings.defaultModel,
      thinkingBudget: activeConv?.effortLevel ?? this.pluginRef.settings.thinkingBudget ?? "medium",
      permissionMode: this.pluginRef.settings.permissionMode,
      contextPercent,
      isStreaming: this.isStreaming,
      vaultFiles,
      mentionedFiles: this.mentionedFiles,
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
      onThinkingBudgetChange: async (budget: string) => {
        if (activeConv) activeConv.effortLevel = budget;
        this.pluginRef.settings.thinkingBudget = budget;
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
      onDismissNote: () => {
        this.noteIncluded = false;
        this.render();
      },
      onMentionFile: (path: string) => {
        if (!this.mentionedFiles.includes(path)) {
          this.mentionedFiles.push(path);
          this.render();
        }
      },
      onRemoveMention: (path: string) => {
        this.mentionedFiles = this.mentionedFiles.filter(f => f !== path);
        this.render();
      },
      onSlashCommand: (action: string) => {
        this.handleSlashCommand(action);
      },
    });

    // History
    if (this.historyVisible) {
      renderChatHistory(this.root, mgr.listConversations(), activeId, {
        onSelectConversation: async (id) => {
          await mgr.openTab(id);
          this.historyVisible = false;
          this.render();
        },
        onDeleteConversation: async (id) => {
          this.tabContainers.delete(id);
          this.tabContextPercent.delete(id);
          this.tabStreamingState.delete(id);
          await mgr.deleteConversation(id);
          this.render();
        },
      });
    }
  }

  private async createNewChat(): Promise<void> {
    const mgr = this.pluginRef.conversationManager;
    if (!mgr) return;
    this.noteIncluded = true;
    this.mentionedFiles = [];
    const conv = await mgr.createConversation(this.pluginRef.settings.defaultModel, this.pluginRef.settings.thinkingBudget);
    await mgr.openTab(conv.id);
    this.render();
  }

  private handleSlashCommand(action: string): void {
    const mgr = this.pluginRef.conversationManager;
    if (!mgr) return;
    const activeId = mgr.getActiveConversationId();

    switch (action) {
      case "compact":
        this.sendMessage("/compact");
        break;
      case "clear":
        if (activeId) {
          mgr.deleteConversation(activeId);
          this.tabContainers.delete(activeId);
          this.tabContextPercent.delete(activeId);
          this.createNewChat();
        }
        break;
      case "model": {
        const models = ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"];
        const cur = this.pluginRef.settings.defaultModel;
        const idx = models.indexOf(cur);
        this.pluginRef.settings.defaultModel = models[(idx + 1) % models.length];
        const activeConv = activeId ? mgr.getConversation(activeId) : undefined;
        if (activeConv) activeConv.model = this.pluginRef.settings.defaultModel;
        this.pluginRef.saveSettings();
        this.render();
        break;
      }
      case "export": {
        if (!activeId) break;
        const conv = mgr.getConversation(activeId);
        if (!conv) break;
        const md = conv.messages.map(m =>
          m.role === "user" ? `**You:** ${m.content}` : `**Archivist:** ${m.content}`
        ).join("\n\n---\n\n");
        navigator.clipboard.writeText(md);
        break;
      }
      case "help":
        this.sendMessage("What commands and abilities do you have?");
        break;
    }
  }

  private async sendMessage(text: string): Promise<void> {
    const mgr = this.pluginRef.conversationManager;
    const agent = this.pluginRef.agentService;
    if (!mgr || !agent) return;

    let activeId = mgr.getActiveConversationId();
    if (!activeId) {
      const conv = await mgr.createConversation(this.pluginRef.settings.defaultModel, this.pluginRef.settings.thinkingBudget);
      await mgr.openTab(conv.id);
      activeId = conv.id;
    }

    await mgr.addMessage(activeId, {
      id: "msg-" + Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });

    this.isStreaming = true;
    if (activeId) this.tabStreamingState.set(activeId, "streaming");
    // Clear cached DOM so render() builds fresh with the new user message
    if (activeId) this.tabContainers.delete(activeId);
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
      currentNotePath: this.noteIncluded ? activeFile?.path : undefined,
      currentNoteContent: this.noteIncluded ? currentNoteContent : undefined,
      selectedText: this.selectedText,
      externalContextPaths: this.pluginRef.settings.externalContextPaths,
    };

    const conv = mgr.getConversation(activeId);
    const model = conv?.model ?? this.pluginRef.settings.defaultModel;
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";

    // Streaming state
    let assistantContent = "";
    let generatedEntity: Message["generatedEntity"] | undefined;
    let currentThinkingBlock: ThinkingBlockHandle | null = null;
    const toolCallBlocks = new Map<string, ToolCallBlockHandle>();
    const generatedBlocks = new Map<string, { handle: GeneratedBlockHandle; entityType: string }>();
    // Track the latest tool call ID for associating results when toolCallId is missing
    let lastToolCallId: string | undefined;
    // Map tool call IDs to tool names so we can infer entity type from the tool name
    const toolCallNames = new Map<string, string>();

    // Content blocks for persistence (re-rendered on tab switch/reopen)
    const contentBlocks: ContentBlock[] = [];
    const toolBlockIndices = new Map<string, number>();
    let thinkingAccumulator = "";
    let segmentText = "";
    const flushTextBlock = () => {
      if (segmentText.trim()) {
        contentBlocks.push({ type: "text", content: segmentText });
      }
      segmentText = "";
    };

    const GENERATE_TOOLS = ["generate_monster", "generate_spell", "generate_item"];
    const getEntityType = (toolName: string): string | null => {
      const name = toolName.replace("mcp__archivist__", "");
      if (name === "generate_monster") return "monster";
      if (name === "generate_spell") return "spell";
      if (name === "generate_item") return "item";
      return null;
    };

    // --- Auto-scroll logic: only scroll if user is near the bottom ---
    const SCROLL_THRESHOLD = 30;
    let autoScrollEnabled = true;

    const scrollHandler = () => {
      if (!messagesContainer) return;
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
      autoScrollEnabled = isAtBottom;
    };
    messagesContainer.addEventListener("scroll", scrollHandler, { passive: true });

    const scrollToBottom = () => {
      if (!autoScrollEnabled) return;
      requestAnimationFrame(() => {
        if (messagesContainer && autoScrollEnabled) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    };

    // Yield control to the browser's rendering pipeline.
    // Without this, microtasks from the async generator run back-to-back
    // and DOM changes never paint until the entire batch is done.
    const yieldToRenderer = () => new Promise<void>(r => setTimeout(r, 0));

    // Track current text segment -- a new text div is created for each text run
    // (so text between tool calls appears in the right order)
    let currentTextDiv: HTMLElement | null = null;
    let currentTextContent = "";

    const ensureTextDiv = () => {
      if (!currentTextDiv) {
        currentTextDiv = streamContainer.createDiv({ cls: "archivist-inquiry-msg-text" });
        currentTextContent = "";
      }
      return currentTextDiv;
    };

    const endTextSegment = () => {
      currentTextDiv = null;
      // Don't reset currentTextContent -- it's accumulated for the full message
    };

    const renderCurrentText = () => {
      if (!currentTextDiv || !currentTextContent) return;
      currentTextDiv.empty();
      MarkdownRenderer.render(this.app, currentTextContent, currentTextDiv, sourcePath, this);
      enhanceCodeBlocks(currentTextDiv);
    };

    try {
      const effort = conv?.effortLevel ?? this.pluginRef.settings.thinkingBudget ?? "medium";
      for await (const event of agent.sendMessage(text, this.pluginRef.settings, context, model, effort)) {
        switch (event.type) {
          case "text_delta": {
            ensureTextDiv();
            const delta = event.content ?? "";
            currentTextContent += delta;
            assistantContent += delta;
            segmentText += delta;
            renderCurrentText();
            scrollToBottom();
            await yieldToRenderer();
            break;
          }

          case "thinking_start": {
            flushTextBlock();
            endTextSegment();
            thinkingAccumulator = "";
            currentThinkingBlock = renderThinkingBlock(streamContainer, this.app, sourcePath, this);
            scrollToBottom();
            await yieldToRenderer();
            break;
          }

          case "thinking_delta": {
            thinkingAccumulator += event.content ?? "";
            if (currentThinkingBlock) {
              currentThinkingBlock.appendContent(event.content ?? "");
              scrollToBottom();
              await yieldToRenderer();
            }
            break;
          }

          case "thinking_end": {
            if (currentThinkingBlock) {
              currentThinkingBlock.finalize();
              currentThinkingBlock = null;
            }
            if (thinkingAccumulator) {
              contentBlocks.push({ type: "thinking", content: thinkingAccumulator });
            }
            thinkingAccumulator = "";
            break;
          }

          case "tool_call_start": {
            flushTextBlock();
            endTextSegment();
            const toolId = event.toolCallId ?? `tool-${Date.now()}`;
            lastToolCallId = toolId;
            toolCallNames.set(toolId, event.toolName ?? "unknown");
            const entityType = getEntityType(event.toolName ?? "");

            const block = renderToolCallBlock(streamContainer, event.toolName ?? "unknown", toolId);
            if (event.toolInput) block.setSummary(event.toolInput);
            toolCallBlocks.set(toolId, block);

            // For generate tools, show a skeleton stat block immediately
            if (entityType) {
              const skeleton = renderBlockSkeleton(streamContainer, entityType);
              generatedBlocks.set(toolId, { handle: skeleton, entityType });
            }

            // Push tool call block for persistence (result filled in on tool_result)
            const blockIdx = contentBlocks.length;
            contentBlocks.push({
              type: "tool_call",
              toolCallId: toolId,
              toolName: event.toolName ?? "unknown",
              toolInput: event.toolInput ?? {},
            });
            toolBlockIndices.set(toolId, blockIdx);

            scrollToBottom();
            await yieldToRenderer();
            break;
          }

          case "tool_input_delta": {
            // No progressive rendering -- skeleton stays until tool_result
            break;
          }

          case "tool_call_end": {
            const toolId = event.toolCallId ?? lastToolCallId;
            if (toolId) {
              const block = toolCallBlocks.get(toolId);
              if (block && event.toolInput) {
                block.setSummary(event.toolInput);
              }
              // Update contentBlocks with final input
              const idx = toolBlockIndices.get(toolId);
              if (idx !== undefined && event.toolInput) {
                (contentBlocks[idx] as Extract<ContentBlock, { type: "tool_call" }>).toolInput = event.toolInput;
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
              // Update contentBlocks with result
              const idx = toolBlockIndices.get(toolId);
              if (idx !== undefined) {
                const cb = contentBlocks[idx] as Extract<ContentBlock, { type: "tool_call" }>;
                cb.toolResult = event.toolResult ?? "";
                cb.isError = event.isError === true;
              }
            }
            // Detect generated entity in tool result -- update existing skeleton or create new
            if (event.toolResult && !event.isError) {
              try {
                const parsed = JSON.parse(event.toolResult);
                let entityType: string | null = null;
                let entityData: unknown = null;

                // Case 1: tool result has {type, data} wrapper (normal path)
                if (parsed.type && parsed.data && ["monster", "spell", "item"].includes(parsed.type)) {
                  entityType = parsed.type;
                  entityData = parsed.data;
                }
                // Case 2: flat entity data without wrapper -- infer type from tool name
                else if (parsed.name && toolId) {
                  const toolName = toolCallNames.get(toolId) ?? "";
                  const inferredType = getEntityType(toolName);
                  if (inferredType) {
                    entityType = inferredType;
                    entityData = parsed;
                  }
                }

                if (entityType && entityData) {
                  generatedEntity = { type: entityType as any, data: entityData };
                  contentBlocks.push({ type: "generated_entity", entityType, data: entityData });
                  const genBlock = toolId ? generatedBlocks.get(toolId) : undefined;
                  if (genBlock) {
                    genBlock.handle.updateFromResult(entityType, entityData);
                  } else {
                    const blockWrapper = streamContainer.createDiv({ cls: "archivist-inquiry-stat-block" });
                    renderGeneratedBlock(blockWrapper, generatedEntity);
                  }
                }
              } catch (err) {
                // Not JSON or other parse error -- check if this is a generate tool
                // and the result might be YAML instead of JSON
                console.debug("[archivist] tool_result not a JSON entity:", err);
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

          case "usage": {
            // Estimate context window from model (200k default)
            const contextWindow = 200000;
            const percent = Math.round(((event.contextTokens ?? 0) / contextWindow) * 100);
            if (activeId) this.tabContextPercent.set(activeId, percent);
            this.updateInputArea();
            break;
          }

          case "compact_boundary": {
            endTextSegment();
            const boundary = streamContainer.createDiv({ cls: "archivist-inquiry-compact-boundary" });
            boundary.createSpan({ text: "Conversation compacted" });
            break;
          }

          case "done": {
            flushTextBlock();
            if (event.durationMs) {
              contentBlocks.push({ type: "footer", durationMs: event.durationMs });
              renderResponseFooter(streamContainer, event.durationMs);
            }
            scrollToBottom();
            break;
          }
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

    // Save the final assistant message with full content blocks for re-rendering
    await mgr.addMessage(activeId, {
      id: "msg-" + Date.now().toString(36),
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
      generatedEntity,
      contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
    });

    // Clean up scroll listener
    messagesContainer.removeEventListener("scroll", scrollHandler);

    this.isStreaming = false;
    if (activeId) {
      this.tabStreamingState.set(activeId, "done");
      setTimeout(() => { this.tabStreamingState.set(activeId, "idle"); this.render(); }, 3000);
    }
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

    const ctxPercent = activeId ? (this.tabContextPercent.get(activeId) ?? 0) : 0;
    const vaultFiles = this.app.vault.getMarkdownFiles().map(f => f.path);
    const inputState: ChatInputState = {
      selectedText: this.selectedText,
      currentNotePath: this.noteIncluded ? (this.app.workspace.getActiveFile()?.path) : undefined,
      model: activeConv?.model ?? this.pluginRef.settings.defaultModel,
      thinkingBudget: activeConv?.effortLevel ?? this.pluginRef.settings.thinkingBudget ?? "medium",
      permissionMode: this.pluginRef.settings.permissionMode,
      contextPercent: ctxPercent,
      isStreaming: this.isStreaming,
      vaultFiles,
      mentionedFiles: this.mentionedFiles,
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
      onThinkingBudgetChange: async (budget: string) => {
        if (activeConv) activeConv.effortLevel = budget;
        this.pluginRef.settings.thinkingBudget = budget;
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
      onDismissNote: () => {
        this.noteIncluded = false;
        this.render();
      },
      onMentionFile: (path: string) => {
        if (!this.mentionedFiles.includes(path)) {
          this.mentionedFiles.push(path);
          this.render();
        }
      },
      onRemoveMention: (path: string) => {
        this.mentionedFiles = this.mentionedFiles.filter(f => f !== path);
        this.render();
      },
      onSlashCommand: (action: string) => {
        this.handleSlashCommand(action);
      },
    });
  }
}
