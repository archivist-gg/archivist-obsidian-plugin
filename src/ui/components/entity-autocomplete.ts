import { setIcon } from "obsidian";
import type { RegisteredEntity } from "../../entities/entity-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntityAutocompleteResult {
  kind: "entity" | "doc";
  name: string;
  entityType?: string;
  source?: "srd" | "custom";
  /** Full vault-relative path (for docs) or entity slug */
  path?: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFIX_MAP: Record<string, string> = {
  "monster:": "monster",
  "spell:": "spell",
  "item:": "magic-item",
  "magic-item:": "magic-item",
  "armor:": "armor",
  "weapon:": "weapon",
  "feat:": "feat",
  "condition:": "condition",
  "class:": "class",
  "background:": "background",
  "doc:": "doc",
};

const TYPE_ICONS: Record<string, string> = {
  monster: "sword",
  spell: "sparkles",
  "magic-item": "gem",
  armor: "shield",
  weapon: "swords",
  feat: "star",
  condition: "alert-triangle",
  class: "users",
  background: "scroll",
  doc: "file-text",
};

// ---------------------------------------------------------------------------
// EntityAutocomplete
// ---------------------------------------------------------------------------

export class EntityAutocomplete {
  private dropdown: HTMLElement | null = null;
  private items: HTMLElement[] = [];
  private activeIndex = -1;
  private lastBracketIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _results: EntityAutocompleteResult[] = [];

  constructor(
    private textarea: HTMLTextAreaElement,
    private container: HTMLElement,
    private searchEntities: (query: string, entityType?: string) => RegisteredEntity[],
    private getVaultFiles: () => string[],
    private onSelect: (entity: EntityAutocompleteResult) => void,
  ) {
    this.textarea.addEventListener("input", () => this.onInput());
    this.textarea.addEventListener("keydown", (e) => this.onKeydown(e));
    document.addEventListener("click", (e) => {
      if (this.dropdown && !this.container.contains(e.target as Node)) this.hide();
    });
  }

  // ---- Input / debounce ----

  private onInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.check(), 200);
  }

  // ---- Trigger detection ----

  private check(): void {
    const val = this.textarea.value;
    const cursor = this.textarea.selectionStart;

    // Scan backwards for [[ without a matching ]] between it and cursor.
    // Do not span across newlines.
    let bracketIdx = -1;
    for (let i = cursor - 1; i >= 1; i--) {
      const ch = val[i];
      // Stop at newline
      if (ch === "\n") break;
      // If we see ]] between a potential [[ and cursor, the ref is already closed
      if (ch === "]" && val[i - 1] === "]") { bracketIdx = -1; break; }
      if (ch === "[" && val[i - 1] === "[") {
        bracketIdx = i - 1;
        break;
      }
    }

    if (bracketIdx === -1) { this.hide(); return; }

    this.lastBracketIndex = bracketIdx;
    const raw = val.slice(bracketIdx + 2, cursor);

    // Parse optional type prefix
    let filterType: string | undefined;
    let query = raw;
    for (const [prefix, type] of Object.entries(PREFIX_MAP)) {
      if (raw.toLowerCase().startsWith(prefix)) {
        filterType = type;
        query = raw.slice(prefix.length);
        break;
      }
    }

    const results: EntityAutocompleteResult[] = [];

    if (filterType === "doc") {
      // Only vault files
      const files = this.getVaultFiles();
      const q = query.toLowerCase();
      const matches = files
        .filter(f => {
          const basename = f.split("/").pop() ?? f;
          return basename.toLowerCase().includes(q) || f.toLowerCase().includes(q);
        })
        .slice(0, 8);
      for (const f of matches) {
        const basename = f.split("/").pop() ?? f;
        const nameNoExt = basename.replace(/\.md$/, "");
        results.push({ kind: "doc", name: nameNoExt, path: f });
      }
    } else if (filterType) {
      // Entity search filtered by type
      const entities = this.searchEntities(query, filterType);
      for (const e of entities.slice(0, 8)) {
        results.push({
          kind: "entity",
          name: e.name,
          entityType: e.entityType,
          source: e.source,
          path: e.filePath,
          data: e.data,
        });
      }
    } else {
      // Mixed: entities + vault files
      const entities = this.searchEntities(query);
      for (const e of entities.slice(0, 8)) {
        results.push({
          kind: "entity",
          name: e.name,
          entityType: e.entityType,
          source: e.source,
          path: e.filePath,
          data: e.data,
        });
      }
      // Add up to 5 vault files if query is non-empty
      if (query.length > 0) {
        const files = this.getVaultFiles();
        const q = query.toLowerCase();
        const docMatches = files
          .filter(f => {
            const basename = f.split("/").pop() ?? f;
            return basename.toLowerCase().includes(q) || f.toLowerCase().includes(q);
          })
          .slice(0, 5);
        for (const f of docMatches) {
          const basename = f.split("/").pop() ?? f;
          const nameNoExt = basename.replace(/\.md$/, "");
          results.push({ kind: "doc", name: nameNoExt, path: f });
        }
      }
    }

    if (results.length === 0) { this.hide(); return; }
    this.show(results);
  }

  // ---- Dropdown rendering ----

  private show(results: EntityAutocompleteResult[]): void {
    this.hide();
    this._results = results;
    this.dropdown = this.container.createDiv({ cls: "archivist-inquiry-entity-dropdown" });
    this.items = [];
    this.activeIndex = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const item = this.dropdown.createDiv({ cls: "archivist-inquiry-entity-item" });

      // Icon
      const iconEl = item.createSpan({ cls: "archivist-inquiry-entity-item-icon" });
      const iconName = r.kind === "doc" ? "file-text" : (TYPE_ICONS[r.entityType ?? ""] ?? "file-text");
      setIcon(iconEl, iconName);

      // Text container
      const textEl = item.createDiv({ cls: "archivist-inquiry-entity-item-text" });
      textEl.createSpan({ cls: "archivist-inquiry-entity-item-name", text: r.name });

      // Source badge
      if (r.kind === "entity" && r.source) {
        const badgeClass = r.source === "srd"
          ? "archivist-inquiry-entity-badge-srd"
          : "archivist-inquiry-entity-badge-custom";
        textEl.createSpan({
          cls: `archivist-inquiry-entity-item-badge ${badgeClass}`,
          text: r.source === "srd" ? "SRD" : "Custom",
        });
      } else if (r.kind === "doc") {
        textEl.createSpan({
          cls: "archivist-inquiry-entity-item-badge archivist-inquiry-entity-badge-doc",
          text: "Doc",
        });
      }

      if (i === 0) item.addClass("archivist-inquiry-entity-item-active");

      const idx = i;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectItem(results[idx]);
      });
      item.addEventListener("mouseenter", () => {
        this.setActive(idx);
      });
      this.items.push(item);
    }
  }

  private hide(): void {
    if (this.dropdown) { this.dropdown.remove(); this.dropdown = null; }
    this.items = [];
    this.activeIndex = -1;
    this._results = [];
  }

  private setActive(idx: number): void {
    if (this.items[this.activeIndex]) this.items[this.activeIndex].removeClass("archivist-inquiry-entity-item-active");
    this.activeIndex = idx;
    if (this.items[idx]) {
      this.items[idx].addClass("archivist-inquiry-entity-item-active");
      this.items[idx].scrollIntoView({ block: "nearest" });
    }
  }

  // ---- Selection ----

  private selectItem(result: EntityAutocompleteResult): void {
    const val = this.textarea.value;
    const cursor = this.textarea.selectionStart;
    const before = val.slice(0, this.lastBracketIndex);
    const after = val.slice(cursor);

    let insertion: string;
    if (result.kind === "doc") {
      insertion = `[[${result.name}]]`;
    } else {
      insertion = `[[${result.entityType}:${result.name}]]`;
    }

    this.textarea.value = before + insertion + " " + after;
    const newCursor = before.length + insertion.length + 1;
    this.textarea.setSelectionRange(newCursor, newCursor);
    this.textarea.focus();

    // Trigger input event so textarea auto-resizes
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));

    this.onSelect(result);
    this.hide();
  }

  // ---- Keyboard navigation ----

  private onKeydown(e: KeyboardEvent): void {
    if (!this.dropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setActive(Math.min(this.activeIndex + 1, this.items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setActive(Math.max(this.activeIndex - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (this.activeIndex >= 0 && this._results[this.activeIndex]) {
        e.preventDefault();
        this.selectItem(this._results[this.activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
    }
  }

  // ---- Public API ----

  isOpen(): boolean {
    return this.dropdown !== null;
  }

  destroy(): void {
    this.hide();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
