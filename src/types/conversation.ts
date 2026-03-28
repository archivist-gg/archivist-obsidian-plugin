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
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
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
