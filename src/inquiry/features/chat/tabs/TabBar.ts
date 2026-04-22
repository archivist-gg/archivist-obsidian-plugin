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
 * TabBar renders a horizontal text-label tab strip with scroll arrows.
 */
export class TabBar {
  private containerEl: HTMLElement;
  private stripEl: HTMLElement;
  private leftArrow: HTMLElement;
  private rightArrow: HTMLElement;
  private callbacks: TabBarCallbacks;
  private contextMenuEl: HTMLElement | null = null;
  private boundCloseContextMenu: () => void;
  private scrollObserver: ResizeObserver | null = null;

  constructor(containerEl: HTMLElement, callbacks: TabBarCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.boundCloseContextMenu = () => this.closeContextMenu();

    // Left scroll arrow
    this.leftArrow = containerEl.createDiv({ cls: 'archivist-tab-scroll-arrow archivist-tab-scroll-left' });
    setIcon(this.leftArrow, 'chevron-left');
    this.leftArrow.addEventListener('click', () => this.scroll(-120));

    // Scrollable tab strip
    this.stripEl = containerEl.createDiv({ cls: 'archivist-tab-bar' });

    // Right scroll arrow
    this.rightArrow = containerEl.createDiv({ cls: 'archivist-tab-scroll-arrow archivist-tab-scroll-right' });
    setIcon(this.rightArrow, 'chevron-right');
    this.rightArrow.addEventListener('click', () => this.scroll(120));

    // Watch for overflow changes
    this.stripEl.addEventListener('scroll', () => this.updateArrows());
    this.scrollObserver = new ResizeObserver(() => this.updateArrows());
    this.scrollObserver.observe(this.stripEl);
  }

  /** Scrolls the tab strip by the given amount. */
  private scroll(amount: number): void {
    this.stripEl.scrollBy({ left: amount, behavior: 'smooth' });
  }

  /** Shows/hides scroll arrows based on overflow state. */
  private updateArrows(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.stripEl;
    const canScrollLeft = scrollLeft > 1;
    const canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;

    this.leftArrow.classList.toggle('visible', canScrollLeft);
    this.rightArrow.classList.toggle('visible', canScrollRight);
  }

  /**
   * Updates the tab bar with new tab data.
   */
  update(items: TabBarItem[]): void {
    this.stripEl.empty();

    for (const item of items) {
      this.renderTab(item, items);
    }

    // Update arrows after DOM settles
    requestAnimationFrame(() => this.updateArrows());
  }

  /** Renders a single tab. */
  private renderTab(item: TabBarItem, allItems: TabBarItem[]): void {
    const tabEl = this.stripEl.createDiv({
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

    // Close button (always visible)
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

    // Scroll active tab into view
    if (item.isActive) {
      requestAnimationFrame(() => {
        tabEl.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      });
    }
  }

  /** Shows a context menu for a tab. */
  private showContextMenu(e: MouseEvent, item: TabBarItem, allItems: TabBarItem[]): void {
    this.closeContextMenu();

    const menuEl = this.containerEl.doc.body.createDiv({ cls: 'archivist-tab-context-menu' });
    menuEl.style.left = `${e.clientX}px`;
    menuEl.style.top = `${e.clientY}px`;

    if (item.canClose) {
      const closeItem = menuEl.createDiv({ cls: 'archivist-tab-context-item', text: 'Close' });
      closeItem.addEventListener('click', () => {
        this.closeContextMenu();
        this.callbacks.onTabClose(item.id);
      });
    }

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
    requestAnimationFrame(() => {
      this.containerEl.doc.addEventListener('click', this.boundCloseContextMenu, { once: true });
    });
  }

  private closeContextMenu(): void {
    if (this.contextMenuEl) {
      this.contextMenuEl.remove();
      this.contextMenuEl = null;
    }
    this.containerEl.doc.removeEventListener('click', this.boundCloseContextMenu);
  }

  destroy(): void {
    this.closeContextMenu();
    this.scrollObserver?.disconnect();
    this.containerEl.empty();
  }
}
