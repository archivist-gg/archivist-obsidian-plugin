import type { App } from "obsidian";
import type { Message } from "../../types/conversation";
import { renderUserMessage, renderAssistantMessage, renderToolCallMessage, renderThinkingIndicator } from "./message-renderer";
import { createOwlIcon } from "./owl-icon";

export function renderChatMessages(parent: HTMLElement, messages: Message[], app: App, sourcePath: string, isStreaming: boolean): HTMLElement {
  const container = parent.createDiv({ cls: "archivist-inquiry-messages" });
  if (messages.length === 0 && !isStreaming) {
    const welcome = container.createDiv({ cls: "archivist-inquiry-welcome" });
    welcome.appendChild(createOwlIcon(32));
    welcome.createDiv({ cls: "archivist-inquiry-welcome-title", text: "Good evening" });
    welcome.createDiv({ cls: "archivist-inquiry-welcome-subtitle", text: "What knowledge do you seek?" });
    return container;
  }
  for (const message of messages) {
    if (message.role === "user") renderUserMessage(container, message);
    else if (message.role === "assistant") renderAssistantMessage(container, message, app, sourcePath);
    else if (message.role === "tool") {
      for (const tc of message.toolCalls ?? []) renderToolCallMessage(container, tc.name, tc.input, true);
    }
  }
  if (isStreaming) renderThinkingIndicator(container);
  requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  return container;
}
