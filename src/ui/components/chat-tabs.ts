export interface TabData { id: string; title: string; isActive: boolean; state?: "idle" | "streaming" | "done"; }

export interface ChatTabsCallbacks {
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseAllTabs: () => void;
}

export function renderChatTabs(parent: HTMLElement, tabs: TabData[], callbacks: ChatTabsCallbacks): HTMLElement {
  const bar = parent.createDiv({ cls: "archivist-inquiry-tabs" });
  for (const tab of tabs) {
    const tabEl = bar.createDiv({
      cls: tab.isActive ? "archivist-inquiry-tab archivist-inquiry-tab-active" : "archivist-inquiry-tab",
    });
    if (tab.state === "streaming") {
      tabEl.createSpan({ cls: "archivist-inquiry-tab-badge archivist-inquiry-tab-badge-streaming" });
    } else if (tab.state === "done") {
      tabEl.createSpan({ cls: "archivist-inquiry-tab-badge archivist-inquiry-tab-badge-done" });
    }
    tabEl.createSpan({ cls: "archivist-inquiry-tab-title", text: tab.title });
    const closeBtn = tabEl.createSpan({ cls: "archivist-inquiry-tab-close", text: "\u00d7" });
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); callbacks.onCloseTab(tab.id); });
    tabEl.addEventListener("click", () => callbacks.onSelectTab(tab.id));
    tabEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showTabContextMenu(e, tab.id, callbacks);
    });
  }
  return bar;
}

function showTabContextMenu(event: MouseEvent, tabId: string, callbacks: ChatTabsCallbacks): void {
  const menu = document.createElement("div");
  menu.addClass("archivist-inquiry-context-menu");
  menu.style.position = "fixed";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  const items = [
    { label: "Close", action: () => callbacks.onCloseTab(tabId) },
    { label: "Close Others", action: () => callbacks.onCloseOtherTabs(tabId) },
    { label: "Close All", action: () => callbacks.onCloseAllTabs() },
  ];
  for (const item of items) {
    const el = menu.createDiv({ cls: "archivist-inquiry-context-menu-item", text: item.label });
    el.addEventListener("click", () => { item.action(); menu.remove(); });
  }
  document.body.appendChild(menu);
  const dismiss = () => { menu.remove(); document.removeEventListener("click", dismiss); };
  setTimeout(() => document.addEventListener("click", dismiss), 0);
}
