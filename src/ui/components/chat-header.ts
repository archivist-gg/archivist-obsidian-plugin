import { setIcon } from "obsidian";
import { createOwlIcon } from "./owl-icon";

export interface ChatHeaderCallbacks {
  onNewChat: () => void;
  onToggleHistory: () => void;
  onClose: () => void;
}

export function renderChatHeader(parent: HTMLElement, callbacks: ChatHeaderCallbacks): HTMLElement {
  const header = parent.createDiv({ cls: "archivist-inquiry-header" });
  const left = header.createDiv({ cls: "archivist-inquiry-header-left" });
  const iconWrap = left.createSpan({ cls: "archivist-inquiry-header-icon" });
  iconWrap.appendChild(createOwlIcon(18));
  left.createSpan({ cls: "archivist-inquiry-header-title", text: "Archivist Inquiry" });

  const right = header.createDiv({ cls: "archivist-inquiry-header-right" });
  const newBtn = right.createDiv({ cls: "archivist-inquiry-header-btn", attr: { "aria-label": "New chat" } });
  setIcon(newBtn, "plus");
  newBtn.addEventListener("click", callbacks.onNewChat);

  const historyBtn = right.createDiv({ cls: "archivist-inquiry-header-btn", attr: { "aria-label": "History" } });
  setIcon(historyBtn, "history");
  historyBtn.addEventListener("click", callbacks.onToggleHistory);

  const closeBtn = right.createDiv({ cls: "archivist-inquiry-header-btn", attr: { "aria-label": "Close" } });
  setIcon(closeBtn, "x");
  closeBtn.addEventListener("click", callbacks.onClose);

  return header;
}
