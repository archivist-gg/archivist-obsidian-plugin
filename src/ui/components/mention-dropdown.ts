import { setIcon } from "obsidian";

export interface MentionMatch {
  path: string;
  basename: string;
}

export class MentionDropdown {
  private dropdown: HTMLElement | null = null;
  private items: HTMLElement[] = [];
  private activeIndex = -1;
  private lastAtIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private textarea: HTMLTextAreaElement,
    private container: HTMLElement,
    private getFiles: () => string[],
    private onSelect: (path: string) => void,
  ) {
    this.textarea.addEventListener("input", () => this.onInput());
    this.textarea.addEventListener("keydown", (e) => this.onKeydown(e));
    // Close on click outside
    document.addEventListener("click", (e) => {
      if (this.dropdown && !this.container.contains(e.target as Node)) this.hide();
    });
  }

  private onInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.check(), 200);
  }

  private check(): void {
    const val = this.textarea.value;
    const cursor = this.textarea.selectionStart;

    // Find last @ before cursor that's preceded by whitespace or start of string
    let atIdx = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (val[i] === "@") {
        if (i === 0 || /\s/.test(val[i - 1])) {
          atIdx = i;
          break;
        }
      }
      if (/\s/.test(val[i])) break; // stop at whitespace
    }

    if (atIdx === -1) { this.hide(); return; }

    this.lastAtIndex = atIdx;
    const query = val.slice(atIdx + 1, cursor).toLowerCase();

    const files = this.getFiles();
    const matches = files
      .map(path => ({ path, basename: path.split("/").pop() ?? path }))
      .filter(f => f.basename.toLowerCase().includes(query) || f.path.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length === 0) { this.hide(); return; }
    this.show(matches);
  }

  private show(matches: MentionMatch[]): void {
    this.hide();
    this.dropdown = this.container.createDiv({ cls: "archivist-inquiry-mention-dropdown" });
    this.items = [];
    this.activeIndex = 0;

    for (let i = 0; i < matches.length; i++) {
      const item = this.dropdown.createDiv({ cls: "archivist-inquiry-mention-item" });
      const iconEl = item.createSpan({ cls: "archivist-inquiry-mention-item-icon" });
      setIcon(iconEl, "file-text");
      const textEl = item.createDiv({ cls: "archivist-inquiry-mention-item-text" });
      textEl.createDiv({ cls: "archivist-inquiry-mention-item-name", text: matches[i].basename });
      if (matches[i].path !== matches[i].basename) {
        textEl.createDiv({ cls: "archivist-inquiry-mention-item-path", text: matches[i].path });
      }
      if (i === 0) item.addClass("archivist-inquiry-mention-item-active");

      const idx = i;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectItem(matches[idx]);
      });
      item.addEventListener("mouseenter", () => {
        this.setActive(idx);
      });
      this.items.push(item);
    }

    this._matches = matches;
  }

  private _matches: MentionMatch[] = [];

  private hide(): void {
    if (this.dropdown) { this.dropdown.remove(); this.dropdown = null; }
    this.items = [];
    this.activeIndex = -1;
  }

  private setActive(idx: number): void {
    if (this.items[this.activeIndex]) this.items[this.activeIndex].removeClass("archivist-inquiry-mention-item-active");
    this.activeIndex = idx;
    if (this.items[idx]) this.items[idx].addClass("archivist-inquiry-mention-item-active");
  }

  private selectItem(match: MentionMatch): void {
    // Replace @query with @filename in textarea
    const val = this.textarea.value;
    const cursor = this.textarea.selectionStart;
    const before = val.slice(0, this.lastAtIndex);
    const after = val.slice(cursor);
    this.textarea.value = before + "@" + match.basename + " " + after;
    const newCursor = before.length + 1 + match.basename.length + 1;
    this.textarea.setSelectionRange(newCursor, newCursor);
    this.textarea.focus();
    this.onSelect(match.path);
    this.hide();
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.dropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setActive(Math.min(this.activeIndex + 1, this.items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setActive(Math.max(this.activeIndex - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (this.activeIndex >= 0 && this._matches[this.activeIndex]) {
        e.preventDefault();
        this.selectItem(this._matches[this.activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
    }
  }

  isOpen(): boolean {
    return this.dropdown !== null;
  }

  destroy(): void {
    this.hide();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
