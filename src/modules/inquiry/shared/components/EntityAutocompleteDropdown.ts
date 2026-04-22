/**
 * EntityAutocompleteDropdown — triggered by `[[` in textarea
 *
 * Pure functions (parseEntityReference, resolveEntityReferences) are exported
 * separately so they can be tested without Obsidian/DOM dependencies.
 *
 * The EntityAutocompleteDropdown class handles DOM interactions and requires
 * an EntityRegistry instance at runtime.
 */
import { execContentEditableCommand } from '../../utils/contentEditable';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntityReference {
  type: string | null;
  name: string;
}

/** Valid entity type prefixes for [[type:Name]] syntax. */
const ENTITY_TYPE_PREFIXES = new Set([
  'monster',
  'spell',
  'item',
  'doc',
  'feat',
  'condition',
  'class',
  'background',
  'armor',
  'weapon',
  'equipment',
]);

// ---------------------------------------------------------------------------
// Pure functions (testable without DOM/Obsidian)
// ---------------------------------------------------------------------------

/**
 * Parse a single `[[type:Name]]` or `[[Name]]` reference string.
 * Returns null if the string is not a valid entity reference.
 */
export function parseEntityReference(text: string): EntityReference | null {
  const match = text.match(/^\[\[(.+?)\]\]$/);
  if (!match) return null;

  const inner = match[1].trim();
  if (inner.length === 0) return null;

  const colonIndex = inner.indexOf(':');
  if (colonIndex !== -1) {
    const typePart = inner.substring(0, colonIndex).trim().toLowerCase();
    const namePart = inner.substring(colonIndex + 1).trim();
    if (typePart.length > 0 && namePart.length > 0) {
      return { type: typePart, name: namePart };
    }
  }

  return { type: null, name: inner };
}

/**
 * Extract all `[[...]]` entity references from a block of text.
 */
export function resolveEntityReferences(text: string): EntityReference[] {
  const regex = /\[\[(.+?)\]\]/g;
  const results: EntityReference[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = `[[${match[1]}]]`;
    const parsed = parseEntityReference(fullMatch);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Autocomplete dropdown class (requires DOM + EntityRegistry at runtime)
// ---------------------------------------------------------------------------

interface AutocompleteResult {
  slug: string;
  name: string;
  entityType: string;
  source: 'srd' | 'custom';
}

/**
 * Minimal interface for input elements that the autocomplete can work with.
 * Works with both HTMLTextAreaElement and RichInput.
 */
interface AutocompleteInputLike {
  /** The underlying DOM element (for focus). */
  readonly el: HTMLElement;
  /** Get text before the cursor position. */
  getTextBeforeCursor(): string;
  /** Remove a number of characters before the cursor. */
  removeTextBeforeCursor(count: number): void;
  /** Focus the input. */
  focus(): void;
}

/** Minimal structural shape of EntityRegistry the dropdown needs. */
interface EntityRegistryEntry {
  slug: string;
  name: string;
  entityType: string;
  source: 'srd' | 'custom';
}

interface EntityRegistryLike {
  search(query: string, entityType: string | undefined, limit: number): EntityRegistryEntry[];
}

/**
 * Autocomplete dropdown that activates when the user types `[[` in the input.
 * Searches the EntityRegistry and inserts `[[type:Name]]` on selection.
 */
export class EntityAutocompleteDropdown {
  private containerEl: HTMLElement;
  private richInput: AutocompleteInputLike;
  // Avoid importing EntityRegistry to prevent Obsidian bundling issues
  private entityRegistry: EntityRegistryLike;
  private dropdownEl: HTMLElement | null = null;
  private results: AutocompleteResult[] = [];
  private selectedIndex = 0;
  private bracketStartIndex = -1;
  private debounceTimer: number | null = null;
  private _isVisible = false;

  private static readonly MAX_RESULTS = 20;
  private static readonly DEBOUNCE_MS = 200;

  private onSelect?: (entityType: string, name: string) => void;

  /** Whether the dropdown is currently visible. */
  get isVisible(): boolean {
    return this._isVisible;
  }

  constructor(
    containerEl: HTMLElement,
    richInput: AutocompleteInputLike,
    entityRegistry: EntityRegistryLike,
    onSelect?: (entityType: string, name: string) => void,
  ) {
    this.containerEl = containerEl;
    this.richInput = richInput;
    this.entityRegistry = entityRegistry;
    this.onSelect = onSelect;
  }

  /**
   * Call from the textarea's input event handler.
   * Detects `[[` trigger and shows/hides the dropdown.
   */
  handleInput(): void {
    if (this.debounceTimer !== null) {
      activeWindow.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = activeWindow.setTimeout(() => {
      this.processInput();
    }, EntityAutocompleteDropdown.DEBOUNCE_MS);
  }

  /**
   * Call from the textarea's keydown event handler.
   * Returns true if the key was consumed by the dropdown.
   */
  handleKeydown(e: KeyboardEvent): boolean {
    if (!this._isVisible) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
      this.renderDropdown();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.renderDropdown();
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (this.results.length > 0) {
        e.preventDefault();
        this.selectItem(this.selectedIndex);
        return true;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
      return true;
    }

    return false;
  }

  /**
   * Hide and clean up the dropdown.
   */
  hide(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }
    this._isVisible = false;
    this.bracketStartIndex = -1;
    this.results = [];
    this.selectedIndex = 0;
  }

  /**
   * Full cleanup — call on destroy.
   */
  destroy(): void {
    if (this.debounceTimer !== null) {
      activeWindow.clearTimeout(this.debounceTimer);
    }
    this.hide();
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private processInput(): void {
    const textBeforeCursor = this.richInput.getTextBeforeCursor();

    // Find the last unmatched `[[`
    const lastBracketIndex = textBeforeCursor.lastIndexOf('[[');
    if (lastBracketIndex === -1) {
      this.hide();
      return;
    }

    // Check it hasn't been closed yet
    const afterBrackets = textBeforeCursor.substring(lastBracketIndex + 2);
    if (afterBrackets.includes(']]')) {
      this.hide();
      return;
    }

    this.bracketStartIndex = lastBracketIndex;
    const query = afterBrackets;

    this.performSearch(query);
  }

  private performSearch(query: string): void {
    if (!this.entityRegistry) {
      this.hide();
      return;
    }

    // Check for type prefix (e.g., "monster:" or "spell:fir")
    let entityType: string | undefined;
    let searchQuery = query;

    const colonIndex = query.indexOf(':');
    if (colonIndex !== -1) {
      const prefix = query.substring(0, colonIndex).toLowerCase();
      if (ENTITY_TYPE_PREFIXES.has(prefix)) {
        // Map user-facing prefixes to SRD store type names
        entityType = prefix;
        searchQuery = query.substring(colonIndex + 1);
      }
    }

    const entities = this.entityRegistry.search(
      searchQuery,
      entityType,
      EntityAutocompleteDropdown.MAX_RESULTS,
    );

    this.results = entities.map((e) => ({
      slug: e.slug,
      name: e.name,
      entityType: e.entityType,
      source: e.source,
    }));

    this.selectedIndex = 0;

    if (this.results.length > 0) {
      this._isVisible = true;
      this.renderDropdown();
    } else {
      this.hide();
    }
  }

  private renderDropdown(): void {
    if (!this.dropdownEl) {
      this.dropdownEl = this.containerEl.createDiv({
        cls: 'claudian-entity-autocomplete-dropdown',
      });
    }

    this.dropdownEl.empty();

    for (let i = 0; i < this.results.length; i++) {
      const result = this.results[i];
      const itemEl = this.dropdownEl.createDiv({
        cls: `claudian-entity-autocomplete-item${i === this.selectedIndex ? ' is-selected' : ''}`,
      });

      const nameEl = itemEl.createSpan({ cls: 'claudian-entity-autocomplete-name' });
      nameEl.setText(result.name);

      const metaEl = itemEl.createSpan({ cls: 'claudian-entity-autocomplete-meta' });
      metaEl.setText(`${result.entityType}${result.source === 'custom' ? ' (custom)' : ''}`);

      itemEl.addEventListener('click', () => {
        this.selectItem(i);
      });

      itemEl.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.renderDropdown();
      });
    }
  }

  private selectItem(index: number): void {
    const item = this.results[index];
    if (!item) return;

    // Calculate how many characters to remove: from [[ to cursor
    const textBeforeCursor = this.richInput.getTextBeforeCursor();
    const charsToRemove = textBeforeCursor.length - this.bracketStartIndex;

    if (this.onSelect) {
      // Remove the [[query from input -- the inline chip represents it
      this.richInput.removeTextBeforeCursor(charsToRemove);
      this.onSelect(item.entityType, item.name);
    } else {
      // Fallback: remove [[query and insert raw text
      this.richInput.removeTextBeforeCursor(charsToRemove);
      execContentEditableCommand(activeDocument, 'insertText', `[[${item.entityType}:${item.name}]]`);
    }

    this.hide();
    this.richInput.focus();
  }
}
