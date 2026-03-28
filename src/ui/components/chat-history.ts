import { setIcon } from "obsidian";
import type { Conversation } from "../../types/conversation";

export interface ChatHistoryCallbacks {
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

interface GroupedConversations { label: string; conversations: Conversation[]; }

function groupByDate(conversations: Conversation[]): GroupedConversations[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);
  const lastMonth = new Date(today.getTime() - 30 * 86400000);

  const groups: GroupedConversations[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "Last Week", conversations: [] },
    { label: "Last Month", conversations: [] },
    { label: "Older", conversations: [] },
  ];
  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= today) groups[0].conversations.push(conv);
    else if (date >= yesterday) groups[1].conversations.push(conv);
    else if (date >= lastWeek) groups[2].conversations.push(conv);
    else if (date >= lastMonth) groups[3].conversations.push(conv);
    else groups[4].conversations.push(conv);
  }
  return groups.filter((g) => g.conversations.length > 0);
}

export function renderChatHistory(parent: HTMLElement, conversations: Conversation[], activeId: string | null, callbacks: ChatHistoryCallbacks): HTMLElement {
  const dropdown = parent.createDiv({ cls: "archivist-inquiry-history" });
  const groups = groupByDate(conversations);
  for (const group of groups) {
    dropdown.createDiv({ cls: "archivist-inquiry-history-label", text: group.label });
    for (const conv of group.conversations) {
      const isActive = conv.id === activeId;
      const item = dropdown.createDiv({
        cls: isActive ? "archivist-inquiry-history-item archivist-inquiry-history-item-active" : "archivist-inquiry-history-item",
      });
      const iconEl = item.createSpan({ cls: "archivist-inquiry-history-icon" });
      setIcon(iconEl, "message-square");
      item.createSpan({ cls: "archivist-inquiry-history-title", text: conv.title });
      const chevron = item.createSpan({ cls: "archivist-inquiry-history-chevron" });
      setIcon(chevron, "chevron-right");
      item.addEventListener("click", () => callbacks.onSelectConversation(conv.id));
    }
  }
  if (conversations.length === 0) {
    dropdown.createDiv({ cls: "archivist-inquiry-history-empty", text: "No conversations yet" });
  }
  return dropdown;
}
