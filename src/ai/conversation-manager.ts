import type { Conversation, ConversationStore, Message } from "../types/conversation";
import { EMPTY_STORE } from "../types/conversation";

function generateId(): string {
  return "conv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** Monotonic timestamp: if Date.now() hasn't advanced, bump by 1ms to guarantee ordering. */
let lastTs = 0;
function monotonicNow(): string {
  let ts = Date.now();
  if (ts <= lastTs) ts = lastTs + 1;
  lastTs = ts;
  return new Date(ts).toISOString();
}

function truncateTitle(text: string, maxLen = 39): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export class ConversationManager {
  private store: ConversationStore;
  private loadFn: () => Promise<ConversationStore | null>;
  private saveFn: (store: ConversationStore) => Promise<void>;
  private maxConversations: number;

  constructor(
    loadFn: () => Promise<ConversationStore | null>,
    saveFn: (store: ConversationStore) => Promise<void>,
    maxConversations = 50,
  ) {
    this.loadFn = loadFn;
    this.saveFn = saveFn;
    this.maxConversations = maxConversations;
    this.store = { conversations: {}, openTabs: [], activeConversationId: null };
  }

  async load(): Promise<void> {
    const data = await this.loadFn();
    if (data) this.store = data;
  }

  private async save(): Promise<void> {
    await this.saveFn(this.store);
  }

  async createConversation(model: string, effortLevel?: string): Promise<Conversation> {
    const now = monotonicNow();
    const conv: Conversation = {
      id: generateId(), title: "New conversation",
      createdAt: now, updatedAt: now, model, effortLevel, messages: [],
    };
    this.store.conversations[conv.id] = conv;
    this.enforceMax();
    await this.save();
    return conv;
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    const conv = this.store.conversations[conversationId];
    if (!conv) return;
    conv.messages.push(message);
    conv.updatedAt = monotonicNow();
    if (message.role === "user" && conv.title === "New conversation") {
      conv.title = truncateTitle(message.content);
    }
    await this.save();
  }

  getConversation(id: string): Conversation | undefined {
    return this.store.conversations[id];
  }

  listConversations(): Conversation[] {
    return Object.values(this.store.conversations)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async deleteConversation(id: string): Promise<void> {
    delete this.store.conversations[id];
    this.store.openTabs = this.store.openTabs.filter((t) => t !== id);
    if (this.store.activeConversationId === id) {
      this.store.activeConversationId = this.store.openTabs[0] ?? null;
    }
    await this.save();
  }

  async openTab(id: string): Promise<void> {
    if (!this.store.openTabs.includes(id)) this.store.openTabs.push(id);
    this.store.activeConversationId = id;
    await this.save();
  }

  async closeTab(id: string): Promise<void> {
    this.store.openTabs = this.store.openTabs.filter((t) => t !== id);
    if (this.store.activeConversationId === id) {
      this.store.activeConversationId = this.store.openTabs[0] ?? null;
    }
    await this.save();
  }

  getOpenTabs(): string[] { return [...this.store.openTabs]; }
  getActiveConversationId(): string | null { return this.store.activeConversationId; }

  async setActiveTab(id: string): Promise<void> {
    if (this.store.openTabs.includes(id)) this.store.activeConversationId = id;
    await this.save();
  }

  async rewindToMessage(conversationId: string, messageId: string): Promise<void> {
    const conv = this.store.conversations[conversationId];
    if (!conv) return;
    const idx = conv.messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    // Keep messages up to and including the target user message
    conv.messages = conv.messages.slice(0, idx + 1);
    conv.updatedAt = new Date().toISOString();
    await this.save();
  }

  async forkConversation(sourceId: string, upToMessageId: string, model: string): Promise<Conversation | null> {
    const source = this.store.conversations[sourceId];
    if (!source) return null;
    const idx = source.messages.findIndex(m => m.id === upToMessageId);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    const newId = "conv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const forked: Conversation = {
      id: newId,
      title: (source.title || "Untitled") + " (fork)",
      createdAt: now,
      updatedAt: now,
      model,
      messages: source.messages.slice(0, idx + 1).map(m => ({ ...m })),
    };
    this.store.conversations[newId] = forked;
    await this.save();
    return forked;
  }

  getStore(): ConversationStore { return this.store; }

  private enforceMax(): void {
    const convs = this.listConversations();
    if (convs.length > this.maxConversations) {
      const toDelete = convs.slice(this.maxConversations);
      for (const c of toDelete) {
        delete this.store.conversations[c.id];
        this.store.openTabs = this.store.openTabs.filter((t) => t !== c.id);
      }
    }
  }
}
