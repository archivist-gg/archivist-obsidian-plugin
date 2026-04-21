/**
 * InquiryModule - Bridge between Archivist's main.ts and Claudian's chat engine
 *
 * Contains all of Claudian's initialization logic but does NOT extend Plugin.
 * Delegates Obsidian API calls (registerView, addCommand, etc.) to the host plugin.
 *
 * Credit: Based on the Claudian obsidian plugin by YishenTu
 * https://github.com/YishenTu/claudian
 */

// Must run before any SDK imports to patch Electron/Node.js realm incompatibility
import { patchSetMaxListenersForElectron } from './utils/electronCompat';
patchSetMaxListenersForElectron();

import type { App, Editor, MarkdownView } from 'obsidian';
import { Notice, Plugin } from 'obsidian';

import { AgentManager } from './core/agents';
import { McpServerManager } from './core/mcp';
import { PluginManager } from './core/plugins';
import { StorageService } from './core/storage';
import { isSubagentToolName, TOOL_TASK } from './core/tools/toolNames';
import type {
  AsyncSubagentStatus,
  ChatMessage,
  ClaudianSettings,
  Conversation,
  ConversationMeta,
  SlashCommand,
  SubagentInfo,
  ToolCallInfo,
} from './core/types';
import {
  DEFAULT_CLAUDE_MODELS,
  DEFAULT_SETTINGS,
  getCliPlatformKey,
  getHostnameKey,
  normalizeVisibleModelVariant,
  VIEW_TYPE_CLAUDIAN,
} from './core/types';
import { ClaudianView } from './features/chat/ClaudianView';
import { type InlineEditContext, InlineEditModal } from './features/inline-edit/ui/InlineEditModal';
import { ClaudianSettingTab } from './features/settings/ClaudianSettings';
import { setLocale } from './i18n';
import { ClaudeCliResolver } from './utils/claudeCli';
import { buildCursorContext } from './utils/editor';
import { getCurrentModelFromEnvironment, getModelsFromEnvironment, parseEnvironmentVariables } from './utils/env';
import { getVaultPath } from './utils/path';
import {
  deleteSDKSession,
  loadSDKSessionMessages,
  loadSubagentToolCalls,
  sdkSessionExists,
  type SDKSessionLoadResult,
} from './utils/sdkSession';
import type { CompendiumManager } from '../entities/compendium-manager';
import { CompendiumSelectModal, CreateCompendiumModal } from '../entities/compendium-modal';
import { createArchivistMcpServer } from '../ai/mcp-server';
import type { SrdStore } from '../ai/srd/srd-store';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { FileSystemAdapter } from 'obsidian';
import { registerTablerIcons } from './shared/icons/tabler-icons';

/**
 * Optional fields the Archivist host plugin adds on top of the base Obsidian Plugin.
 * InquiryModule depends on these softly; they may be undefined when the module is
 * embedded in a different host.
 */
interface ArchivistHostPlugin extends Plugin {
  compendiumManager?: CompendiumManager;
  settings?: {
    compendiumRoot?: string;
    userEntityFolder?: string;
    ttrpgRootDir?: string;
  };
}

/** Legacy settings fields removed during migration. */
interface LegacyClaudianSettings {
  claudeCliPaths?: Record<string, string>;
}

// ============================================
// Subagent data merge helpers (pure functions)
// ============================================

function chooseRicherResult(sdkResult?: string, cachedResult?: string): string | undefined {
  const sdkText = typeof sdkResult === 'string' ? sdkResult.trim() : '';
  const cachedText = typeof cachedResult === 'string' ? cachedResult.trim() : '';

  if (sdkText.length === 0 && cachedText.length === 0) return undefined;
  if (sdkText.length === 0) return cachedResult;
  if (cachedText.length === 0) return sdkResult;

  return sdkText.length >= cachedText.length ? sdkResult : cachedResult;
}

function chooseRicherToolCalls(
  sdkToolCalls: ToolCallInfo[] = [],
  cachedToolCalls: ToolCallInfo[] = []
): ToolCallInfo[] {
  if (sdkToolCalls.length >= cachedToolCalls.length) return sdkToolCalls;
  return cachedToolCalls;
}

function normalizeAsyncStatus(
  subagent: SubagentInfo | undefined,
  modeOverride?: SubagentInfo['mode']
): AsyncSubagentStatus | undefined {
  if (!subagent) return undefined;

  const mode = modeOverride ?? subagent.mode;
  if (mode === 'sync') return undefined;
  if (mode === 'async') return subagent.asyncStatus ?? subagent.status;
  return subagent.asyncStatus;
}

function isTerminalAsyncStatus(status: AsyncSubagentStatus | undefined): boolean {
  return status === 'completed' || status === 'error' || status === 'orphaned';
}

function mergeSubagentInfo(
  taskToolCall: ToolCallInfo,
  cachedSubagent: SubagentInfo
): SubagentInfo {
  const sdkSubagent = taskToolCall.subagent;
  const cachedAsyncStatus = normalizeAsyncStatus(cachedSubagent);
  if (!sdkSubagent) {
    return {
      ...cachedSubagent,
      asyncStatus: cachedAsyncStatus,
      result: chooseRicherResult(taskToolCall.result, cachedSubagent.result),
    };
  }

  const sdkAsyncStatus = normalizeAsyncStatus(sdkSubagent);
  const sdkIsTerminal = isTerminalAsyncStatus(sdkAsyncStatus);
  const cachedIsTerminal = isTerminalAsyncStatus(cachedAsyncStatus);
  const sdkResult = taskToolCall.result ?? sdkSubagent.result;

  // Prefer cached data only when it reached a terminal state but SDK hasn't yet
  const preferred = (!sdkIsTerminal && cachedIsTerminal) ? cachedSubagent : sdkSubagent;

  const mergedMode = sdkSubagent.mode
    ?? cachedSubagent.mode
    ?? (taskToolCall.input?.run_in_background === true ? 'async' : undefined);
  const fallbackResult = chooseRicherResult(sdkResult, cachedSubagent.result);
  const mergedResult = preferred === cachedSubagent
    ? (cachedSubagent.result ?? fallbackResult)
    : fallbackResult;
  const mergedAsyncStatus = normalizeAsyncStatus(preferred, mergedMode);

  return {
    ...cachedSubagent,
    ...sdkSubagent,
    description: sdkSubagent.description || cachedSubagent.description,
    prompt: sdkSubagent.prompt || cachedSubagent.prompt,
    mode: mergedMode,
    status: preferred.status,
    asyncStatus: mergedAsyncStatus,
    result: mergedResult,
    toolCalls: chooseRicherToolCalls(sdkSubagent.toolCalls, cachedSubagent.toolCalls),
    agentId: sdkSubagent.agentId || cachedSubagent.agentId,
    outputToolId: sdkSubagent.outputToolId || cachedSubagent.outputToolId,
    startedAt: sdkSubagent.startedAt ?? cachedSubagent.startedAt,
    completedAt: sdkSubagent.completedAt ?? cachedSubagent.completedAt,
    isExpanded: sdkSubagent.isExpanded ?? cachedSubagent.isExpanded,
  };
}

function ensureTaskToolCall(
  msg: ChatMessage,
  subagentId: string,
  subagent: SubagentInfo
): ToolCallInfo {
  msg.toolCalls = msg.toolCalls || [];
  let taskToolCall = msg.toolCalls.find(
    tc => tc.id === subagentId && isSubagentToolName(tc.name)
  );

  if (!taskToolCall) {
    taskToolCall = {
      id: subagentId,
      name: TOOL_TASK,
      input: {
        description: subagent.description,
        prompt: subagent.prompt || '',
        ...(subagent.mode === 'async' ? { run_in_background: true } : {}),
      },
      status: subagent.status,
      result: subagent.result,
      isExpanded: false,
      subagent,
    };
    msg.toolCalls.push(taskToolCall);
    return taskToolCall;
  }

  if (!taskToolCall.input.description) taskToolCall.input.description = subagent.description;
  if (!taskToolCall.input.prompt) taskToolCall.input.prompt = subagent.prompt || '';
  if (subagent.mode === 'async') taskToolCall.input.run_in_background = true;
  const mergedSubagent = mergeSubagentInfo(taskToolCall, subagent);
  taskToolCall.status = mergedSubagent.status;
  if (mergedSubagent.mode === 'async') {
    taskToolCall.input.run_in_background = true;
  }
  if (mergedSubagent.result !== undefined) {
    taskToolCall.result = mergedSubagent.result;
  }
  taskToolCall.subagent = mergedSubagent;
  return taskToolCall;
}

// ============================================
// InquiryModule
// ============================================

/**
 * InquiryModule wraps Claudian's chat engine for use inside the Archivist plugin.
 *
 * It does NOT extend Plugin. Instead, it delegates all Obsidian API registration
 * (registerView, addCommand, addRibbonIcon, etc.) to the host plugin instance.
 */
export class InquiryModule {
  /** The host Obsidian plugin (for Obsidian API delegation). */
  plugin: Plugin;

  /** The Obsidian App instance. */
  app: App;

  /** Inquiry settings (Claudian settings). */
  settings: ClaudianSettings;

  /** MCP server manager. */
  mcpManager: McpServerManager;

  /** Plugin manager. */
  pluginManager: PluginManager;

  /** Agent manager. */
  agentManager: AgentManager;

  /** Storage service. */
  storage: StorageService;

  /** Claude CLI resolver. */
  cliResolver: ClaudeCliResolver;

  /** D&D entity registry (optional, injected by Archivist). */
  entityRegistry: unknown;

  /** D&D SRD store (optional, injected by Archivist). */
  srdStore: unknown;

  /** Factory to create fresh in-process MCP server instances for D&D tools.
   *  Each tab's ClaudianService needs its own instance (Protocol can only connect once). */
  createArchivistMcpServerInstance: (() => McpSdkServerConfigWithInstance) | null = null;

  /** @deprecated Use createArchivistMcpServerInstance() instead. Kept for interface compat. */
  get archivistMcpServer(): McpSdkServerConfigWithInstance | null {
    return this.createArchivistMcpServerInstance?.() ?? null;
  }

  private conversations: Conversation[] = [];
  private runtimeEnvironmentVariables = '';

  constructor(
    plugin: Plugin,
    app: App,
    entityRegistry?: unknown,
    srdStore?: unknown,
  ) {
    this.plugin = plugin;
    this.app = app;
    this.entityRegistry = entityRegistry ?? null;
    this.srdStore = srdStore ?? null;
  }

  /**
   * Initialize the inquiry module.
   * Equivalent to Claudian's onload() but delegates API calls to this.plugin.
   */
  async init(): Promise<void> {
    registerTablerIcons();

    await this.loadSettings();

    this.cliResolver = new ClaudeCliResolver();

    // Initialize MCP manager (shared for agent + UI)
    this.mcpManager = new McpServerManager(this.storage.mcp);
    await this.mcpManager.loadServers();

    // Set up factory for in-process MCP server (each tab needs its own instance)
    if (this.srdStore) {
      const srdStore = this.srdStore as SrdStore;
      this.createArchivistMcpServerInstance = () => createArchivistMcpServer(srdStore, (this.plugin as ArchivistHostPlugin).compendiumManager);
    }

    // Initialize plugin manager (reads from installed_plugins.json + settings.json)
    const vaultPath = this.app.vault.adapter instanceof FileSystemAdapter
      ? this.app.vault.adapter.getBasePath()
      : '';
    this.pluginManager = new PluginManager(vaultPath, this.storage.ccSettings);
    await this.pluginManager.loadPlugins();

    // Initialize agent manager (loads plugin agents from plugin install paths)
    this.agentManager = new AgentManager(vaultPath, this.pluginManager);
    await this.agentManager.loadAgents();

    this.plugin.registerView(
      VIEW_TYPE_CLAUDIAN,
      (leaf) => new ClaudianView(leaf, this)
    );

    this.plugin.addRibbonIcon('bot', 'Open Archivist Inquiry', () => {
      void this.activateView();
    });

    this.plugin.addCommand({
      id: 'open-inquiry-view',
      name: 'Open chat view',
      callback: () => {
        void this.activateView();
      },
    });

    this.plugin.addCommand({
      id: 'inquiry-inline-edit',
      name: 'Inline edit',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selectedText = editor.getSelection();
        const notePath = view.file?.path || 'unknown';

        let editContext: InlineEditContext;
        if (selectedText.trim()) {
          editContext = { mode: 'selection', selectedText };
        } else {
          const cursor = editor.getCursor();
          const cursorContext = buildCursorContext(
            (line) => editor.getLine(line),
            editor.lineCount(),
            cursor.line,
            cursor.ch
          );
          editContext = { mode: 'cursor', cursorContext };
        }

        const modal = new InlineEditModal(
          this.app,
          this,
          editor,
          view,
          editContext,
          notePath,
          () => this.getView()?.getActiveTab()?.ui.externalContextSelector?.getExternalContexts() ?? []
        );
        const result = await modal.openAndWait();

        if (result.decision === 'accept' && result.editedText !== undefined) {
          new Notice(editContext.mode === 'cursor' ? 'Inserted' : 'Edit applied');
        }
      },
    });

    this.plugin.addCommand({
      id: 'inquiry-new-tab',
      name: 'New tab',
      checkCallback: (checking: boolean) => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
        if (!leaf) return false;

        const view = leaf.view as ClaudianView;
        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        if (!tabManager.canCreateTab()) return false;

        if (!checking) {
          void tabManager.createTab();
        }
        return true;
      },
    });

    this.plugin.addCommand({
      id: 'inquiry-new-session',
      name: 'New session (in current tab)',
      checkCallback: (checking: boolean) => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
        if (!leaf) return false;

        const view = leaf.view as ClaudianView;
        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        const activeTab = tabManager.getActiveTab();
        if (!activeTab) return false;

        if (activeTab.state.isStreaming) return false;

        if (!checking) {
          void tabManager.createNewConversation();
        }
        return true;
      },
    });

    this.plugin.addCommand({
      id: 'inquiry-close-current-tab',
      name: 'Close current tab',
      checkCallback: (checking: boolean) => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
        if (!leaf) return false;

        const view = leaf.view as ClaudianView;
        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        if (!checking) {
          const activeTabId = tabManager.getActiveTabId();
          if (activeTabId) {
            // When closing the last tab, TabManager will create a new empty one
            void tabManager.closeTab(activeTabId);
          }
        }
        return true;
      },
    });

    this.plugin.addSettingTab(new ClaudianSettingTab(this.app, this, this.plugin));
  }

  /**
   * Destroy the inquiry module.
   * Equivalent to Claudian's onunload().
   */
  async destroy(): Promise<void> {
    // Ensures state is saved even if Obsidian quits without calling onClose()
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (tabManager) {
        const state = tabManager.getPersistedState();
        await this.storage.setTabManagerState(state);
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];

    if (!leaf) {
      const newLeaf = this.settings.openInMainTab
        ? workspace.getLeaf('tab')
        : workspace.getRightLeaf(false);
      if (newLeaf) {
        await newLeaf.setViewState({
          type: VIEW_TYPE_CLAUDIAN,
          active: true,
        });
        leaf = newLeaf;
      }
    }

    if (leaf) {
      await workspace.revealLeaf(leaf);
    }
  }

  /** Loads settings and conversations from persistent storage. */
  async loadSettings() {
    // Initialize storage service (handles migration if needed)
    this.storage = new StorageService(this.plugin);
    const { claudian } = await this.storage.initialize();

    const slashCommands = await this.storage.loadAllSlashCommands();

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...claudian,
      slashCommands,
    };

    // Migrate legacy permission mode values to new names
    const pm = this.settings.permissionMode as string;
    if (pm === 'yolo' || pm === 'plan' || pm === 'normal') {
      this.settings.permissionMode = (pm === 'normal' || pm === 'plan') ? 'guarded' : 'unleashed';
    }

    // Ensure tabs are in header position
    if ((this.settings as { tabBarPosition?: string }).tabBarPosition === 'input') {
      this.settings.tabBarPosition = 'header';
    }

    // Ensure maxTabs is updated from old default
    if (this.settings.maxTabs <= 3) {
      this.settings.maxTabs = 10;
    }

    const didNormalizeModelVariants = this.normalizeModelVariantSettings();

    // Initialize and migrate legacy CLI paths to hostname-based paths
    this.settings.claudeCliPathsByHost ??= {};
    const hostname = getHostnameKey();
    let didMigrateCliPath = false;

    if (!this.settings.claudeCliPathsByHost[hostname]) {
      const platformPaths = (this.settings as ClaudianSettings & LegacyClaudianSettings).claudeCliPaths;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- migration path only
      const migratedPath = platformPaths?.[getCliPlatformKey()]?.trim() || this.settings.claudeCliPath?.trim();

      if (migratedPath) {
        this.settings.claudeCliPathsByHost[hostname] = migratedPath;
        this.settings.claudeCliPath = '';
        didMigrateCliPath = true;
      }
    }

    delete (this.settings as ClaudianSettings & LegacyClaudianSettings).claudeCliPaths;

    // Load all conversations from session files (legacy JSONL + native metadata)
    const { conversations: legacyConversations, failedCount } = await this.storage.sessions.loadAllConversations();
    const legacyIds = new Set(legacyConversations.map(c => c.id));

    // Overlay native metadata onto legacy conversations if present
    for (const conversation of legacyConversations) {
      const meta = await this.storage.sessions.loadMetadata(conversation.id);
      if (!meta) continue;

      conversation.isNative = true;
      conversation.title = meta.title ?? conversation.title;
      conversation.titleGenerationStatus = meta.titleGenerationStatus ?? conversation.titleGenerationStatus;
      conversation.createdAt = meta.createdAt ?? conversation.createdAt;
      conversation.updatedAt = meta.updatedAt ?? conversation.updatedAt;
      conversation.lastResponseAt = meta.lastResponseAt ?? conversation.lastResponseAt;
      if (meta.sessionId !== undefined) {
        conversation.sessionId = meta.sessionId;
      }
      conversation.currentNote = meta.currentNote ?? conversation.currentNote;
      conversation.externalContextPaths = meta.externalContextPaths ?? conversation.externalContextPaths;
      conversation.enabledMcpServers = meta.enabledMcpServers ?? conversation.enabledMcpServers;
      conversation.usage = meta.usage ?? conversation.usage;
      if (meta.sdkSessionId !== undefined) {
        conversation.sdkSessionId = meta.sdkSessionId;
      } else if (conversation.sdkSessionId === undefined && conversation.sessionId) {
        conversation.sdkSessionId = conversation.sessionId;
      }
      conversation.previousSdkSessionIds = meta.previousSdkSessionIds ?? conversation.previousSdkSessionIds;
      conversation.legacyCutoffAt = meta.legacyCutoffAt ?? conversation.legacyCutoffAt;
      conversation.subagentData = meta.subagentData ?? conversation.subagentData;
      conversation.resumeSessionAt = meta.resumeSessionAt ?? conversation.resumeSessionAt;
      conversation.forkSource = meta.forkSource ?? conversation.forkSource;
    }

    // Also load native session metadata (no legacy JSONL)
    const nativeMetadata = await this.storage.sessions.listNativeMetadata();
    const nativeConversations: Conversation[] = nativeMetadata
      .filter(meta => !legacyIds.has(meta.id))
      .map(meta => {
        const resumeSessionId = meta.sessionId !== undefined ? meta.sessionId : meta.id;
        const sdkSessionId = meta.sdkSessionId !== undefined
          ? meta.sdkSessionId
          : (resumeSessionId ?? undefined);

        return {
          id: meta.id,
          title: meta.title,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          lastResponseAt: meta.lastResponseAt,
          sessionId: resumeSessionId,
          sdkSessionId,
          previousSdkSessionIds: meta.previousSdkSessionIds,
          messages: [], // Messages are in SDK storage, loaded on demand
          currentNote: meta.currentNote,
          externalContextPaths: meta.externalContextPaths,
          enabledMcpServers: meta.enabledMcpServers,
          usage: meta.usage,
          titleGenerationStatus: meta.titleGenerationStatus,
          legacyCutoffAt: meta.legacyCutoffAt,
          isNative: true,
          subagentData: meta.subagentData, // Preserve for applying to loaded messages
          resumeSessionAt: meta.resumeSessionAt,
          forkSource: meta.forkSource,
        };
      });

    this.conversations = [...legacyConversations, ...nativeConversations].sort(
      (a, b) => (b.lastResponseAt ?? b.updatedAt) - (a.lastResponseAt ?? a.updatedAt)
    );

    if (failedCount > 0) {
      new Notice(`Failed to load ${failedCount} conversation${failedCount > 1 ? 's' : ''}`);
    }
    setLocale(this.settings.locale);

    const backfilledConversations = this.backfillConversationResponseTimestamps();

    this.runtimeEnvironmentVariables = this.settings.environmentVariables || '';
    const { changed, invalidatedConversations } = this.reconcileModelWithEnvironment(this.runtimeEnvironmentVariables);

    if (changed || didMigrateCliPath || didNormalizeModelVariants) {
      await this.saveSettings();
    }

    // Persist backfilled and invalidated conversations to their session files
    const conversationsToSave = new Set([...backfilledConversations, ...invalidatedConversations]);
    for (const conv of conversationsToSave) {
      if (conv.isNative) {
        // Native session: save metadata only
        await this.storage.sessions.saveMetadata(
          this.storage.sessions.toSessionMetadata(conv)
        );
      } else {
        // Legacy session: save full JSONL
        await this.storage.sessions.saveConversation(conv);
      }
    }
  }

  private backfillConversationResponseTimestamps(): Conversation[] {
    const updated: Conversation[] = [];
    for (const conv of this.conversations) {
      if (conv.lastResponseAt != null) continue;
      if (!conv.messages || conv.messages.length === 0) continue;

      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i];
        if (msg.role === 'assistant') {
          conv.lastResponseAt = msg.timestamp;
          updated.push(conv);
          break;
        }
      }
    }
    return updated;
  }

  normalizeModelVariantSettings(): boolean {
    const { enableOpus1M, enableSonnet1M } = this.settings;
    let changed = false;

    const normalize = (model: string): string =>
      normalizeVisibleModelVariant(model, enableOpus1M, enableSonnet1M);

    const normalizedModel = normalize(this.settings.model);
    if (this.settings.model !== normalizedModel) {
      this.settings.model = normalizedModel;
      changed = true;
    }

    const normalizedTitleModel = normalize(this.settings.titleGenerationModel);
    if (this.settings.titleGenerationModel !== normalizedTitleModel) {
      this.settings.titleGenerationModel = normalizedTitleModel;
      changed = true;
    }

    if (this.settings.lastClaudeModel) {
      const normalizedLastClaudeModel = normalize(this.settings.lastClaudeModel);
      if (this.settings.lastClaudeModel !== normalizedLastClaudeModel) {
        this.settings.lastClaudeModel = normalizedLastClaudeModel;
        changed = true;
      }
    }

    return changed;
  }

  /** Persists settings to storage. */
  async saveSettings() {
    const { slashCommands, ...settingsToSave } = this.settings;
    void slashCommands;
    await this.storage.saveClaudianSettings(settingsToSave);
  }

  /** Updates and persists environment variables, restarting processes to apply changes. */
  async applyEnvironmentVariables(envText: string): Promise<void> {
    const envChanged = envText !== this.runtimeEnvironmentVariables;

    this.settings.environmentVariables = envText;

    if (!envChanged) {
      await this.saveSettings();
      return;
    }

    // Update runtime env vars so new processes use them
    this.runtimeEnvironmentVariables = envText;

    const { changed, invalidatedConversations } = this.reconcileModelWithEnvironment(envText);
    await this.saveSettings();

    if (invalidatedConversations.length > 0) {
      for (const conv of invalidatedConversations) {
        if (conv.isNative) {
          await this.storage.sessions.saveMetadata(
            this.storage.sessions.toSessionMetadata(conv)
          );
        } else {
          await this.storage.sessions.saveConversation(conv);
        }
      }
    }

    const view = this.getView();
    const tabManager = view?.getTabManager();

    if (tabManager) {
      for (const tab of tabManager.getAllTabs()) {
        if (tab.state.isStreaming) {
          tab.controllers.inputController?.cancelStreaming();
        }
      }

      let failedTabs = 0;
      if (changed) {
        for (const tab of tabManager.getAllTabs()) {
          if (!tab.service || !tab.serviceInitialized) {
            continue;
          }
          try {
            const externalContextPaths = tab.ui.externalContextSelector?.getExternalContexts() ?? [];
            tab.service.resetSession();
            await tab.service.ensureReady({ externalContextPaths });
          } catch {
            failedTabs++;
          }
        }
      } else {
        // Restart initialized tabs to pick up env changes
        try {
          await tabManager.broadcastToAllTabs(
            async (service) => { await service.ensureReady({ force: true }); }
          );
        } catch {
          failedTabs++;
        }
      }
      if (failedTabs > 0) {
        new Notice(`Environment changes applied, but ${failedTabs} tab(s) failed to restart.`);
      }
    }

    view?.refreshModelSelector();

    const noticeText = changed
      ? 'Environment variables applied. Sessions will be rebuilt on next message.'
      : 'Environment variables applied.';
    new Notice(noticeText);
  }

  /** Returns the runtime environment variables (fixed at plugin load). */
  getActiveEnvironmentVariables(): string {
    return this.runtimeEnvironmentVariables;
  }

  getResolvedClaudeCliPath(): string | null {
    return this.cliResolver.resolve(
      this.settings.claudeCliPathsByHost,  // Per-device paths (preferred)
      this.settings.claudeCliPath,          // Legacy path (fallback)
      this.getActiveEnvironmentVariables()
    );
  }

  private getDefaultModelValues(): string[] {
    return DEFAULT_CLAUDE_MODELS.map((m) => m.value);
  }

  private getPreferredCustomModel(envVars: Record<string, string>, customModels: { value: string }[]): string {
    const envPreferred = getCurrentModelFromEnvironment(envVars);
    if (envPreferred && customModels.some((m) => m.value === envPreferred)) {
      return envPreferred;
    }
    return customModels[0].value;
  }

  /** Computes a hash of model and provider base URL environment variables for change detection. */
  private computeEnvHash(envText: string): string {
    const envVars = parseEnvironmentVariables(envText || '');
    const modelKeys = [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    ];
    const providerKeys = [
      'ANTHROPIC_BASE_URL',
    ];
    const allKeys = [...modelKeys, ...providerKeys];
    const relevantPairs = allKeys
      .filter(key => envVars[key])
      .map(key => `${key}=${envVars[key]}`)
      .sort()
      .join('|');
    return relevantPairs;
  }

  /**
   * Reconciles model with environment.
   * Returns { changed, invalidatedConversations } where changed indicates if
   * settings were modified (requiring save), and invalidatedConversations lists
   * conversations that had their sessionId cleared (also requiring save).
   */
  private reconcileModelWithEnvironment(envText: string): {
    changed: boolean;
    invalidatedConversations: Conversation[];
  } {
    const currentHash = this.computeEnvHash(envText);
    const savedHash = this.settings.lastEnvHash || '';

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    // Hash changed - model or provider may have changed.
    // Session invalidation is now handled per-tab by TabManager.
    // Clear resume sessionId from all conversations since they belong to the old provider.
    // Sessions are provider-specific (contain signed thinking blocks, etc.).
    // NOTE: sdkSessionId is retained for loading SDK-stored history.
    const invalidatedConversations: Conversation[] = [];
    for (const conv of this.conversations) {
      if (conv.sessionId) {
        conv.sessionId = null;
        invalidatedConversations.push(conv);
      }
    }

    const envVars = parseEnvironmentVariables(envText || '');
    const customModels = getModelsFromEnvironment(envVars);

    if (customModels.length > 0) {
      this.settings.model = this.getPreferredCustomModel(envVars, customModels);
    } else {
      this.settings.model = DEFAULT_CLAUDE_MODELS[0].value;
    }

    this.settings.lastEnvHash = currentHash;
    return { changed: true, invalidatedConversations };
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateDefaultTitle(): string {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getConversationPreview(conv: Conversation): string {
    const firstUserMsg = conv.messages.find(m => m.role === 'user');
    if (!firstUserMsg) {
      // For native sessions without loaded messages, indicate it's a persisted session
      // rather than "New conversation" which implies no content exists
      return conv.isNative ? 'SDK session' : 'New conversation';
    }
    return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
  }

  /** Fork has no owned session yet; still referencing the source session for resume. */
  private isPendingFork(conversation: Conversation): boolean {
    return !!conversation.forkSource &&
      !conversation.sdkSessionId &&
      !conversation.sessionId;
  }

  private async loadSdkMessagesForConversation(conversation: Conversation): Promise<void> {
    if (!conversation.isNative || conversation.sdkMessagesLoaded) return;

    const vaultPath = getVaultPath(this.app);
    if (!vaultPath) return;

    const isPendingFork = this.isPendingFork(conversation);

    const allSessionIds: string[] = isPendingFork
      ? [conversation.forkSource!.sessionId]
      : [
          ...(conversation.previousSdkSessionIds || []),
          conversation.sdkSessionId ?? conversation.sessionId,
        ].filter((id): id is string => !!id);

    if (allSessionIds.length === 0) return;

    const allSdkMessages: ChatMessage[] = [];
    let missingSessionCount = 0;
    let errorCount = 0;
    let successCount = 0;

    const currentSessionId = isPendingFork
      ? conversation.forkSource!.sessionId
      : (conversation.sdkSessionId ?? conversation.sessionId);

    for (const sessionId of allSessionIds) {
      if (!sdkSessionExists(vaultPath, sessionId)) {
        missingSessionCount++;
        continue;
      }

      const isCurrentSession = sessionId === currentSessionId;
      const truncateAt = isCurrentSession
        ? (isPendingFork ? conversation.forkSource!.resumeAt : conversation.resumeSessionAt)
        : undefined;
      const result: SDKSessionLoadResult = await loadSDKSessionMessages(
        vaultPath, sessionId, truncateAt
      );

      if (result.error) {
        errorCount++;
        continue;
      }

      successCount++;
      allSdkMessages.push(...result.messages);
    }

    // Note: We intentionally don't notify users about missing session files.
    // Session files may be missing due to path encoding differences (special characters
    // in vault path) or external deletion. Showing a notification every restart is
    // too intrusive and not actionable for users.

    // Only mark as loaded if at least one session was successfully loaded,
    // or if all sessions were missing (no point retrying non-existent files).
    // If sessions exist but ALL failed to load, allow retry on next view.
    const allSessionsMissing = missingSessionCount === allSessionIds.length;
    const hasLoadErrors = errorCount > 0 && successCount === 0 && !allSessionsMissing;
    if (hasLoadErrors) {
      // Don't mark as loaded - allow retry on next view
      return;
    }

    // Filter out rebuilt context messages (history blobs sent on session reset)
    const filteredSdkMessages = allSdkMessages.filter(msg => !msg.isRebuiltContext);

    // Apply legacy cutoff filter if needed
    const afterCutoff = conversation.legacyCutoffAt != null
      ? filteredSdkMessages.filter(msg => msg.timestamp > conversation.legacyCutoffAt!)
      : filteredSdkMessages;

    const merged = this.dedupeMessages([
      ...conversation.messages,
      ...afterCutoff,
    ]).sort((a, b) => a.timestamp - b.timestamp);

    // Apply cached subagentData to loaded messages (for Agent tool count and status)
    if (conversation.subagentData) {
      await this.enrichAsyncSubagentToolCalls(
        conversation.subagentData,
        vaultPath,
        allSessionIds
      );
      this.applySubagentData(merged, conversation.subagentData);
    }

    conversation.messages = merged;
    conversation.sdkMessagesLoaded = true;
  }

  private async enrichAsyncSubagentToolCalls(
    subagentData: Record<string, SubagentInfo>,
    vaultPath: string,
    sessionIds: string[]
  ): Promise<void> {
    const uniqueSessionIds = [...new Set(sessionIds)];
    if (uniqueSessionIds.length === 0) return;

    const loaderCache = new Map<string, ReturnType<typeof loadSubagentToolCalls>>();

    for (const subagent of Object.values(subagentData)) {
      if (subagent.mode !== 'async') continue;
      if (!subagent.agentId) continue;
      if ((subagent.toolCalls?.length ?? 0) > 0) continue;

      for (const sessionId of uniqueSessionIds) {
        const cacheKey = `${sessionId}:${subagent.agentId}`;

        let loader = loaderCache.get(cacheKey);
        if (!loader) {
          loader = loadSubagentToolCalls(vaultPath, sessionId, subagent.agentId);
          loaderCache.set(cacheKey, loader);
        }

        const recoveredToolCalls = await loader;
        if (recoveredToolCalls.length === 0) continue;

        subagent.toolCalls = recoveredToolCalls.map(toolCall => ({
          ...toolCall,
          input: { ...toolCall.input },
        }));
        break;
      }
    }
  }

  /**
   * Applies cached subagentData to messages.
   * Restores subagent info so Agent tools can show tool count and status.
   * Also updates contentBlocks to properly identify Agent tools as subagents.
   */
  private applySubagentData(messages: ChatMessage[], subagentData: Record<string, SubagentInfo>): void {
    const attachedSubagentIds = new Set<string>();

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;

      // Apply subagent data to the message
      for (const [subagentId, subagent] of Object.entries(subagentData)) {
        const hasSubagentBlock = msg.contentBlocks?.some(
          b => (b.type === 'subagent' && b.subagentId === subagentId) ||
               (b.type === 'tool_use' && b.toolId === subagentId)
        );
        const hasTaskToolCall = msg.toolCalls?.some(tc => tc.id === subagentId) ?? false;

        if (!hasSubagentBlock && !hasTaskToolCall) continue;
        ensureTaskToolCall(msg, subagentId, subagent);

        // Update contentBlock from tool_use to subagent, or update existing subagent block with mode
        if (!msg.contentBlocks) {
          msg.contentBlocks = [];
        }

        let hasNormalizedSubagentBlock = false;
        for (let i = 0; i < msg.contentBlocks.length; i++) {
          const block = msg.contentBlocks[i];
          if (block.type === 'tool_use' && block.toolId === subagentId) {
            msg.contentBlocks[i] = {
              type: 'subagent',
              subagentId,
              mode: subagent.mode,
            };
            hasNormalizedSubagentBlock = true;
          } else if (block.type === 'subagent' && block.subagentId === subagentId && !block.mode) {
            block.mode = subagent.mode;
            hasNormalizedSubagentBlock = true;
          } else if (block.type === 'subagent' && block.subagentId === subagentId) {
            hasNormalizedSubagentBlock = true;
          }
        }

        if (!hasNormalizedSubagentBlock && hasTaskToolCall) {
          msg.contentBlocks.push({
            type: 'subagent',
            subagentId,
            mode: subagent.mode,
          });
        }

        attachedSubagentIds.add(subagentId);
      }
    }

    for (const [subagentId, subagent] of Object.entries(subagentData)) {
      if (attachedSubagentIds.has(subagentId)) continue;

      let anchor = [...messages].reverse().find((msg): msg is ChatMessage => msg.role === 'assistant');
      if (!anchor) {
        anchor = {
          id: `subagent-recovery-${subagentId}`,
          role: 'assistant',
          content: '',
          timestamp: subagent.completedAt ?? subagent.startedAt ?? Date.now(),
          contentBlocks: [],
        };
        messages.push(anchor);
      }

      ensureTaskToolCall(anchor, subagentId, subagent);

      anchor.contentBlocks = anchor.contentBlocks || [];
      const hasSubagentBlock = anchor.contentBlocks.some(
        block => block.type === 'subagent' && block.subagentId === subagentId
      );
      if (!hasSubagentBlock) {
        anchor.contentBlocks.push({
          type: 'subagent',
          subagentId,
          mode: subagent.mode,
        });
      }
    }
  }

  private dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
    const seen = new Set<string>();
    const result: ChatMessage[] = [];

    for (const message of messages) {
      // Use message.id as primary key - more reliable than content-based deduplication
      // especially for tool-only messages or messages with identical content
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      result.push(message);
    }

    return result;
  }

  /**
   * Creates a new conversation and sets it as active.
   *
   * New conversations always use SDK-native storage.
   * The session ID may be captured after the first SDK response.
   */
  async createConversation(sessionId?: string): Promise<Conversation> {
    const conversationId = sessionId ?? this.generateConversationId();
    const conversation: Conversation = {
      id: conversationId,
      title: this.generateDefaultTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: sessionId ?? null,
      sdkSessionId: sessionId ?? undefined,
      messages: [],
      isNative: true,
    };

    this.conversations.unshift(conversation);
    // Save new conversation (metadata only - SDK handles messages)
    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conversation)
    );

    return conversation;
  }

  /**
   * Switches to an existing conversation by ID.
   *
   * For native sessions, loads messages from SDK storage if not already loaded.
   */
  async switchConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return null;

    await this.loadSdkMessagesForConversation(conversation);

    return conversation;
  }

  /**
   * Deletes a conversation and resets any tabs using it.
   *
   * For native sessions, deletes the metadata file and SDK session file.
   * For legacy sessions, deletes the JSONL file.
   */
  async deleteConversation(id: string): Promise<void> {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index === -1) return;

    const conversation = this.conversations[index];
    this.conversations.splice(index, 1);

    const vaultPath = getVaultPath(this.app);
    const sdkSessionId = conversation.sdkSessionId ?? conversation.sessionId;
    if (vaultPath && sdkSessionId) {
      await deleteSDKSession(vaultPath, sdkSessionId);
    }

    if (conversation.isNative) {
      // Native session: delete metadata file
      await this.storage.sessions.deleteMetadata(id);
    } else {
      // Legacy session: delete JSONL file
      await this.storage.sessions.deleteConversation(id);
    }

    // Notify all views/tabs that have this conversation open
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      for (const tab of tabManager.getAllTabs()) {
        if (tab.conversationId === id) {
          tab.controllers.inputController?.cancelStreaming();
          await tab.controllers.conversationController?.createNew({ force: true });
        }
      }
    }
  }

  /** Renames a conversation. */
  async renameConversation(id: string, title: string): Promise<void> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return;

    conversation.title = title.trim() || this.generateDefaultTitle();
    conversation.updatedAt = Date.now();

    if (conversation.isNative) {
      // Native session: save metadata only
      await this.storage.sessions.saveMetadata(
        this.storage.sessions.toSessionMetadata(conversation)
      );
    } else {
      // Legacy session: save full JSONL
      await this.storage.sessions.saveConversation(conversation);
    }
  }

  /**
   * Updates conversation properties.
   *
   * For native sessions, saves metadata only (SDK handles messages including images).
   * For legacy sessions, saves full JSONL.
   *
   * Image data is cleared from memory after save (SDK/JSONL has persisted it),
   * except for pending fork conversations whose images aren't yet in SDK storage.
   */
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return;

    Object.assign(conversation, updates, { updatedAt: Date.now() });

    if (conversation.isNative) {
      // Native session: save metadata only (SDK handles messages including images)
      await this.storage.sessions.saveMetadata(
        this.storage.sessions.toSessionMetadata(conversation)
      );
    } else {
      // Legacy session: save full JSONL
      await this.storage.sessions.saveConversation(conversation);
    }

    // Clear image data from memory after save (data is persisted by SDK or JSONL).
    // Skip for pending forks: their deep-cloned images aren't in SDK storage yet.
    if (!this.isPendingFork(conversation)) {
      for (const msg of conversation.messages) {
        if (msg.images) {
          for (const img of msg.images) {
            img.data = '';
          }
        }
      }
    }
  }

  /**
   * Gets a conversation by ID from the in-memory cache.
   *
   * For native sessions, loads messages from SDK storage if not already loaded.
   */
  async getConversationById(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.find(c => c.id === id) || null;

    if (conversation) {
      await this.loadSdkMessagesForConversation(conversation);
    }

    return conversation;
  }

  /**
   * Gets a conversation by ID without loading SDK messages.
   * Use this for UI code that only needs metadata (title, etc.).
   */
  getConversationSync(id: string): Conversation | null {
    return this.conversations.find(c => c.id === id) || null;
  }

  /** Finds an existing empty conversation (no messages). */
  findEmptyConversation(): Conversation | null {
    return this.conversations.find(c => c.messages.length === 0) || null;
  }

  /** Returns conversation metadata list for the history dropdown. */
  getConversationList(): ConversationMeta[] {
    return this.conversations.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastResponseAt: c.lastResponseAt,
      messageCount: c.messages.length,
      preview: this.getConversationPreview(c),
      titleGenerationStatus: c.titleGenerationStatus,
      isNative: c.isNative,
    }));
  }

  /** Returns the active Claudian view from workspace, if open. */
  getView(): ClaudianView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN);
    if (leaves.length > 0) {
      return leaves[0].view as ClaudianView;
    }
    return null;
  }

  /** Returns all open Claudian views in the workspace. */
  getAllViews(): ClaudianView[] {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN);
    return leaves.map(leaf => leaf.view as ClaudianView);
  }

  /**
   * Checks if a conversation is open in any Claudian view.
   * Returns the view and tab if found, null otherwise.
   */
  findConversationAcrossViews(conversationId: string): { view: ClaudianView; tabId: string } | null {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      const tabs = tabManager.getAllTabs();
      for (const tab of tabs) {
        if (tab.conversationId === conversationId) {
          return { view, tabId: tab.id };
        }
      }
    }
    return null;
  }

  /**
   * Returns the Archivist host plugin's settings (compendiumRoot, userEntityFolder, etc.).
   * Falls back to sensible defaults if unavailable.
   */
  getArchivistSettings(): { compendiumRoot: string; userEntityFolder: string; ttrpgRootDir: string } {
    const hostSettings = (this.plugin as ArchivistHostPlugin).settings;
    return {
      compendiumRoot: hostSettings?.compendiumRoot ?? 'Compendium',
      userEntityFolder: hostSettings?.userEntityFolder ?? 'me',
      ttrpgRootDir: hostSettings?.ttrpgRootDir ?? '/',
    };
  }

  /**
   * Saves an entity to the vault as a markdown note.
   * Used by the "Copy & Save" button in D&D entity blocks rendered in chat.
   */
  async saveEntityToVault(entityType: string, data: Record<string, unknown>, compendiumName?: string): Promise<string | undefined> {
    const compManager = (this.plugin as ArchivistHostPlugin).compendiumManager;
    if (!compManager) {
      new Notice("Compendium system not initialized");
      return undefined;
    }

    if (!compendiumName) {
      const writable = compManager.getWritable();
      if (writable.length === 0) {
        return new Promise<string | undefined>((resolve) => {
          new CreateCompendiumModal(this.app, compManager, (comp) => {
            void this.saveEntityToVault(entityType, data, comp.name).then(resolve);
          }).open();
        });
      }
      if (writable.length === 1) {
        compendiumName = writable[0].name;
      } else {
        return new Promise<string | undefined>((resolve) => {
          new CompendiumSelectModal(this.app, writable, (comp) => {
            void this.saveEntityToVault(entityType, data, comp.name).then(resolve);
          }, compManager).open();
        });
      }
    }

    try {
      const registered = await compManager.saveEntity(compendiumName, entityType, data);
      new Notice(`Saved to ${registered.filePath}`);
      return registered.slug;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to save: ${message}`);
      return undefined;
    }
  }

  /**
   * Gets SDK supported commands from any ready service.
   * The command list is the same for all services, so we just need one ready.
   * Used by inline edit and other contexts that don't have direct TabManager access.
   */
  async getSdkCommands(): Promise<SlashCommand[]> {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (tabManager) {
        const commands = await tabManager.getSdkCommands();
        if (commands.length > 0) {
          return commands;
        }
      }
    }
    return [];
  }
}

// Re-export InquiryModule as default for import convenience
export default InquiryModule;
