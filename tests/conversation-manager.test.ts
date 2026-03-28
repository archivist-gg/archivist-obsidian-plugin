import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../src/ai/conversation-manager";
import type { ConversationStore } from "../src/types/conversation";

describe("ConversationManager", () => {
  let manager: ConversationManager;
  let savedData: ConversationStore | null = null;

  beforeEach(() => {
    savedData = null;
    manager = new ConversationManager(
      async () => savedData,
      async (data) => { savedData = data; },
    );
  });

  it("creates a new conversation", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe("New conversation");
    expect(conv.messages).toEqual([]);
  });

  it("adds a message to a conversation", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    await manager.addMessage(conv.id, {
      id: "msg-1", role: "user", content: "Generate a dragon", timestamp: new Date().toISOString(),
    });
    const updated = manager.getConversation(conv.id);
    expect(updated?.messages.length).toBe(1);
    expect(updated?.messages[0].content).toBe("Generate a dragon");
  });

  it("auto-titles from first user message", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    await manager.addMessage(conv.id, {
      id: "msg-1", role: "user",
      content: "Generate a CR 5 fire dragon for my volcanic lair encounter",
      timestamp: new Date().toISOString(),
    });
    const updated = manager.getConversation(conv.id);
    expect(updated?.title).toBe("Generate a CR 5 fire dragon for my v...");
  });

  it("lists conversations sorted by updatedAt", async () => {
    const c1 = await manager.createConversation("claude-sonnet-4-6");
    const c2 = await manager.createConversation("claude-sonnet-4-6");
    await manager.addMessage(c1.id, {
      id: "msg-1", role: "user", content: "First", timestamp: new Date().toISOString(),
    });
    const list = manager.listConversations();
    expect(list[0].id).toBe(c1.id);
  });

  it("deletes a conversation", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    await manager.deleteConversation(conv.id);
    expect(manager.getConversation(conv.id)).toBeUndefined();
  });

  it("manages open tabs", async () => {
    const c1 = await manager.createConversation("claude-sonnet-4-6");
    const c2 = await manager.createConversation("claude-sonnet-4-6");
    manager.openTab(c1.id);
    manager.openTab(c2.id);
    expect(manager.getOpenTabs()).toEqual([c1.id, c2.id]);
    manager.closeTab(c1.id);
    expect(manager.getOpenTabs()).toEqual([c2.id]);
  });

  it("enforces max conversations", async () => {
    const mgr = new ConversationManager(
      async () => savedData, async (data) => { savedData = data; }, 2,
    );
    await mgr.createConversation("claude-sonnet-4-6");
    await mgr.createConversation("claude-sonnet-4-6");
    await mgr.createConversation("claude-sonnet-4-6");
    const list = mgr.listConversations();
    expect(list.length).toBe(2);
  });
});
