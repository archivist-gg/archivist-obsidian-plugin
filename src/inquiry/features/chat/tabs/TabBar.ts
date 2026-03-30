import { setIcon } from 'obsidian';

import type { TabBarItem, TabId } from './types';

/** Callbacks for TabBar interactions. */
export interface TabBarCallbacks {
  /** Called when a tab is clicked. */
  onTabClick: (tabId: TabId) => void;

  /** Called when the close button is clicked on a tab. */
  onTabClose: (tabId: TabId) => void;

  /** Called when the new tab button is clicked. */
  onNewTab: () => void;
}

/**
 * TabBar renders a horizontal text-label tab strip.
 * Each tab shows a title, optional state dot, and close button on hover.
 */
export class TabBar {
  private containerEl: HTMLElement;
  private callbacks: TabBarCallbacks;
  private contextMenuEl: HTMLElement | null = null;
  private boundCloseContextMenu: () => void;

  constructor(containerEl: HTMLElement, callbacks: TabBarCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.boundCloseContextMenu = () => this.closeContextMenu();
    this.build();
  }

  /** Builds the tab bar UI. */
  private build(): void {
    this.containerEl.addClass('archivist-tab-bar');
  }

  /**
   * Updates the tab bar with new tab data.
   * @param items Tab items to render.
   */
  update(items: TabBarItem[]): void {
    this.containerEl.empty();

    for (const item of items) {
      this.renderTab(item, items);
    }
  }

  /** Renders a single tab. */
  private renderTab(item: TabBarItem, allItems: TabBarItem[]): void {
    const tabEl = this.containerEl.createDiv({
      cls: `archivist-tab${item.isActive ? ' archivist-tab-active' : ''}`,
    });

    // State dot (streaming or attention)
    if (item.isStreaming || item.needsAttention) {
      const dotEl = tabEl.createDiv({ cls: 'archivist-tab-dot' });
      if (item.isStreaming) {
        dotEl.addClass('archivist-tab-dot-streaming');
      } else if (item.needsAttention) {
        dotEl.addClass('archivist-tab-dot-attention');
      }
    }

    // Title
    const titleEl = tabEl.createDiv({ cls: 'archivist-tab-title' });
    titleEl.setText(item.title);
    titleEl.setAttribute('title', item.title);

    // Close button (visible on hover via CSS)
    if (item.canClose) {
      const closeEl = tabEl.createDiv({ cls: 'archivist-tab-close' });
      setIcon(closeEl, 'x');
      closeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onTabClose(item.id);
      });
    }

    // Click to switch tab
    tabEl.addEventListener('click', () => {
      this.callbacks.onTabClick(item.id);
    });

    // Right-click context menu
    tabEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, item, allItems);
    });
  }

  /** Shows a context menu for a tab. */
  private showContextMenu(e: MouseEvent, item: TabBarItem, allItems: TabBarItem[]): void {
    this.closeContextMenu();

    const menuEl = document.body.createDiv({ cls: 'archivist-tab-context-menu' });
    menuEl.style.position = 'fixed';
    menuEl.style.left = `${e.clientX}px`;
    menuEl.style.top = `${e.clientY}px`;

    // Close
    if (item.canClose) {
      const closeItem = menuEl.createDiv({ cls: 'archivist-tab-context-item', text: 'Close' });
      closeItem.addEventListener('click', () => {
        this.closeContextMenu();
        this.callbacks.onTabClose(item.id);
      });
    }

    // Close Others
    const otherClosable = allItems.filter(t => t.id !== item.id && t.canClose);
    if (otherClosable.length > 0) {
      const closeOthersItem = menuEl.createDiv({ cls: 'archivist-tab-context-item', text: 'Close Others' });
      closeOthersItem.addEventListener('click', () => {
        this.closeContextMenu();
        for (const other of otherClosable) {
          this.callbacks.onTabClose(other.id);
        }
      });
    }

    // Close All
    const allClosable = allItems.filter(t => t.canClose);
    if (allClosable.length > 1) {
      const closeAllItem = menuEl.createDiv({ cls: 'archivist-tab-context-item', text: 'Close All' });
      closeAllItem.addEventListener('click', () => {
        this.closeContextMenu();
        for (const tab of allClosable) {
          this.callbacks.onTabClose(tab.id);
        }
      });
    }

    this.contextMenuEl = menuEl;

    // Close on outside click (next tick to avoid immediate close)
    requestAnimationFrame(() => {
      document.addEventListener('click', this.boundCloseContextMenu, { once: true });
    });
  }

  /** Closes the context menu if open. */
  private closeContextMenu(): void {
    if (this.contextMenuEl) {
      this.contextMenuEl.remove();
      this.contextMenuEl = null;
    }
    document.removeEventListener('click', this.boundCloseContextMenu);
  }

  /** Destroys the tab bar. */
  destroy(): void {
    this.closeContextMenu();
    this.containerEl.empty();
    this.containerEl.removeClass('archivist-tab-bar');
  }
}
