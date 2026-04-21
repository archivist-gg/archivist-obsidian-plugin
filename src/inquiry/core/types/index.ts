// Chat types
export {
  type ChatMessage,
  type ContentBlock,
  type Conversation,
  type ConversationMeta,
  type ForkSource,
  type ImageAttachment,
  type ImageMediaType,
  type SessionMetadata,
  type StreamChunk,
  type UsageInfo,
  VIEW_TYPE_CLAUDIAN,
} from './chat';

// Model types
export {
  type ClaudeModel,
  CONTEXT_WINDOW_1M,
  CONTEXT_WINDOW_STANDARD,
  DEFAULT_CLAUDE_MODELS,
  DEFAULT_EFFORT_LEVEL,
  DEFAULT_THINKING_BUDGET,
  EFFORT_LEVELS,
  type EffortLevel,
  filterVisibleModelOptions,
  getContextWindowSize,
  isAdaptiveThinkingModel,
  normalizeVisibleModelVariant,
  THINKING_BUDGETS,
} from './models';

// SDK types
export { type SDKMessage } from './sdk';

// Settings types
export {
  type ApprovalDecision,
  type CCPermissions,
  type CCSettings,
  type ClaudianSettings,
  type CliPlatformKey,
  createPermissionRule,
  DEFAULT_CC_PERMISSIONS,
  DEFAULT_CC_SETTINGS,
  DEFAULT_SETTINGS,
  type EnvSnippet,
  getBashToolBlockedCommands,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- migration path only
  getCliPlatformKey,
  getCurrentPlatformBlockedCommands,
  getCurrentPlatformKey,
  getDefaultBlockedCommands,
  type HostnameCliPaths,
  type InstructionRefineResult,
  type KeyboardNavigationSettings,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- migration path only
  type LegacyPermission,
  legacyPermissionsToCCPermissions,
  legacyPermissionToCCRule,
  parseCCPermissionRule,
  type PermissionMode,
  type PermissionRule,
  type PlatformBlockedCommands,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- migration path only
  type PlatformCliPaths,
  type SlashCommand,
  type TabBarPosition,
} from './settings';

// Re-export getHostnameKey from utils (moved from settings for architecture compliance)
export { getHostnameKey } from '../../utils/env';

// Diff types
export {
  type DiffLine,
  type DiffStats,
  type SDKToolUseResult,
  type StructuredPatchHunk,
} from './diff';

// Tool types
export {
  type AskUserAnswers,
  type AskUserQuestionItem,
  type AskUserQuestionOption,
  type AsyncSubagentStatus,
  type ExitPlanModeCallback,
  type ExitPlanModeDecision,
  type SubagentInfo,
  type SubagentMode,
  type ToolCallInfo,
  type ToolDiffData,
} from './tools';

// MCP types
export {
  type ClaudianMcpConfigFile,
  type ClaudianMcpServer,
  DEFAULT_MCP_SERVER,
  getMcpServerType,
  isValidMcpServerConfig,
  type McpConfigFile,
  type McpHttpServerConfig,
  type McpServerConfig,
  type McpServerType,
  type McpSSEServerConfig,
  type McpStdioServerConfig,
  type ParsedMcpConfig,
} from './mcp';

// Plugin types
export {
  type ClaudianPlugin,
  type InstalledPluginEntry,
  type InstalledPluginsFile,
  type PluginScope,
} from './plugins';

// Agent types
export {
  AGENT_PERMISSION_MODES,
  type AgentDefinition,
  type AgentFrontmatter,
  type AgentPermissionMode,
} from './agent';
