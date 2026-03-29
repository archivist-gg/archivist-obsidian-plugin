export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock =
  | { type: "thinking"; content: string }
  | { type: "tool_call"; toolCallId: string; toolName: string; toolInput: Record<string, unknown>; toolResult?: string; isError?: boolean }
  | { type: "text"; content: string }
  | { type: "generated_entity"; entityType: string; data: unknown }
  | { type: "footer"; durationMs: number };

export interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: string;
  /** For assistant messages that contain a generated entity */
  generatedEntity?: {
    type: "monster" | "spell" | "item" | "encounter" | "npc";
    data: unknown;
  };
  /** Ordered content blocks for faithful re-rendering (thinking, tool calls, text, entities, footer) */
  contentBlocks?: ContentBlock[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  effortLevel?: string;
  messages: Message[];
}

export interface ConversationStore {
  conversations: Record<string, Conversation>;
  openTabs: string[];
  activeConversationId: string | null;
}

export const EMPTY_STORE: ConversationStore = {
  conversations: {},
  openTabs: [],
  activeConversationId: null,
};
