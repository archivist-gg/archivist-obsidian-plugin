/**
 * RichInput — contentEditable div replacing the textarea for chat input.
 *
 * Supports inline chips for [[entity]], @mention, and file selections.
 * Provides a value getter, serialization, and cursor-relative text APIs
 * that autocomplete dropdowns can use instead of textarea.value / selectionStart.
 */
import { setIcon } from 'obsidian';
import { execContentEditableCommand } from '../../../utils/contentEditable';

// ---------------------------------------------------------------------------
// Serialization result
// ---------------------------------------------------------------------------

export interface RichInputSerialized {
  /** Plain-text representation (entity chips become [[type:Name]]). */
  text: string;
  /** Entity references extracted from inline chips. */
  entityRefs: Array<{ type: string; name: string }>;
  /** Absolute file paths from file chips (NOT included in text). */
  filePaths: string[];
}

// ---------------------------------------------------------------------------
// RichInput
// ---------------------------------------------------------------------------

export interface RichInputOptions {
  placeholder?: string;
  onInput?: () => void;
}

const ZERO_WIDTH_SPACE = '\u200B';

export class RichInput {
  readonly el: HTMLDivElement;
  onInput: (() => void) | null;

  constructor(container: HTMLElement, options: RichInputOptions = {}) {
    this.el = container.createDiv({
      cls: 'claudian-rich-input',
      attr: {
        contenteditable: 'true',
        role: 'textbox',
        'aria-multiline': 'true',
        dir: 'auto',
        'data-placeholder': options.placeholder ?? '',
      },
    });

    this.onInput = options.onInput ?? null;

    // ---- Event listeners ----

    // Fire onInput callback on DOM input events
    this.el.addEventListener('input', () => {
      this.onInput?.();
    });

    // Paste: strip formatting, insert plain text
    this.el.addEventListener('paste', (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (text) {
        execContentEditableCommand(this.el.doc, 'insertText', text);
      }
    });

    // Shift+Enter: insert line break
    this.el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey && !e.isComposing) {
        e.preventDefault();
        execContentEditableCommand(this.el.doc, 'insertLineBreak');
      }
    });
  }

  // ---- Value accessors ----

  /** Returns plain text content (strips zero-width spaces). */
  get value(): string {
    return (this.el.textContent ?? '').replace(/\u200B/g, '');
  }

  /** True if no text and no chips. */
  get isEmpty(): boolean {
    const text = this.value.trim();
    if (text.length > 0) return false;
    return this.el.querySelector('.archivist-inline-chip') === null;
  }

  // ---- Mutations ----

  /** Remove all children safely (no innerHTML). */
  clear(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }
  }

  /** Set plain text content (replaces everything). */
  setText(text: string): void {
    this.clear();
    this.el.textContent = text;
  }

  // ---- Serialization ----

  /**
   * Walk the DOM tree and produce a structured result.
   *
   * - Entity chips (data-entity-type + data-entity-name) serialize to [[type:Name]] in text
   *   and are added to entityRefs.
   * - File chips (data-file-path) add to filePaths (NOT to text).
   * - MCP/agent chips (data-mention-id, data-mention-type) serialize to @id or @id (agent) in text.
   * - BR elements become \n.
   * - DIV elements that follow a sibling add \n before their content.
   */
  serialize(): RichInputSerialized {
    const entityRefs: Array<{ type: string; name: string }> = [];
    const filePaths: string[] = [];
    const parts: string[] = [];

    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push((node.textContent ?? '').replace(/\u200B/g, ''));
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      // BR -> newline
      if (el.tagName === 'BR') {
        parts.push('\n');
        return;
      }

      // Inline chip
      if (el.classList.contains('archivist-inline-chip')) {
        const entityType = el.dataset.entityType;
        const entityName = el.dataset.entityName;
        const filePath = el.dataset.filePath;
        const mentionId = el.dataset.mentionId;
        const mentionType = el.dataset.mentionType;

        if (entityType && entityName) {
          parts.push(`[[${entityType}:${entityName}]]`);
          entityRefs.push({ type: entityType, name: entityName });
        } else if (filePath) {
          filePaths.push(filePath);
          // File chips are NOT included in text
        } else if (mentionId) {
          if (mentionType === 'agent') {
            parts.push(`@${mentionId} (agent) `);
          } else {
            parts.push(`@${mentionId} `);
          }
        }
        return;
      }

      // DIV elements add newline if they have a previousSibling
      if (el.tagName === 'DIV' && el.previousSibling) {
        parts.push('\n');
      }

      // Recurse into children
      for (const child of Array.from(el.childNodes)) {
        walk(child);
      }
    };

    for (const child of Array.from(this.el.childNodes)) {
      walk(child);
    }

    return {
      text: parts.join(''),
      entityRefs,
      filePaths,
    };
  }

  // ---- Cursor-relative text APIs ----

  /** Get text from start of input to cursor position. */
  getTextBeforeCursor(): string {
    const sel = this.el.win.getSelection();
    if (!sel || sel.rangeCount === 0) return '';

    try {
      const range = sel.getRangeAt(0);
      const doc = this.el.doc;
      const preRange = doc.createRange();
      preRange.selectNodeContents(this.el);
      preRange.setEnd(range.startContainer, range.startOffset);

      const fragment = preRange.cloneContents();
      const tempDiv = doc.createElement('div');
      tempDiv.appendChild(fragment);

      // Walk the fragment to extract text, serializing chips the same way
      return this.extractTextFromFragment(tempDiv);
    } catch {
      return '';
    }
  }

  /** Remove `count` characters before the cursor using Selection API. */
  removeTextBeforeCursor(count: number): void {
    const sel = this.el.win.getSelection();
    if (!sel || sel.rangeCount === 0 || count <= 0) return;

    this.el.focus();

    // Use Selection.modify to extend selection backward, then delete
    for (let i = 0; i < count; i++) {
      sel.modify('extend', 'backward', 'character');
    }
    execContentEditableCommand(this.el.doc, 'delete');
  }

  /** Returns cursor offset as character count from start (like selectionStart). */
  get selectionStart(): number {
    return this.getTextBeforeCursor().length;
  }

  // ---- Chip insertion ----

  /** Insert an entity chip at the cursor position. */
  insertEntityChip(entityType: string, name: string): void {
    const chip = this.createChipElement({
      cls: 'archivist-inline-chip',
      dataAttrs: { 'entity-type': entityType, 'entity-name': name },
    });

    const typeSpan = chip.createSpan({ cls: 'archivist-inline-chip-type' });
    typeSpan.textContent = entityType;

    const nameSpan = chip.createSpan({ cls: 'archivist-inline-chip-name' });
    nameSpan.textContent = name;

    this.appendRemoveButton(chip);
    this.insertNodeAtCursor(chip);
    this.insertZeroWidthSpace();
    this.onInput?.();
  }

  /** Insert a file chip at the cursor position. */
  insertFileChip(path: string, displayName: string): void {
    const chip = this.createChipElement({
      cls: 'archivist-inline-chip archivist-inline-chip-file',
      dataAttrs: { 'file-path': path },
    });

    const iconSpan = chip.createSpan({ cls: 'archivist-inline-chip-icon' });
    setIcon(iconSpan, 'file-text');

    const nameSpan = chip.createSpan({ cls: 'archivist-inline-chip-name' });
    nameSpan.textContent = displayName;

    this.appendRemoveButton(chip);
    this.insertNodeAtCursor(chip);
    this.insertZeroWidthSpace();
    this.onInput?.();
  }

  /** Insert an MCP/agent chip at the cursor position. */
  insertMentionChip(
    id: string,
    displayName: string,
    icon: string,
    chipType: 'mcp' | 'agent',
  ): void {
    const chip = this.createChipElement({
      cls: 'archivist-inline-chip',
      dataAttrs: { 'mention-id': id, 'mention-type': chipType },
    });

    const iconSpan = chip.createSpan({ cls: 'archivist-inline-chip-icon' });
    setIcon(iconSpan, icon);

    const nameSpan = chip.createSpan({ cls: 'archivist-inline-chip-name' });
    nameSpan.textContent = displayName;

    this.appendRemoveButton(chip);
    this.insertNodeAtCursor(chip);
    this.insertZeroWidthSpace();
    this.onInput?.();
  }

  // ---- Focus ----

  focus(): void {
    this.el.focus();
  }

  blur(): void {
    this.el.blur();
  }

  // ---- Private helpers ----

  private createChipElement(opts: {
    cls: string;
    dataAttrs: Record<string, string>;
  }): HTMLSpanElement {
    const chip = this.el.doc.createElement('span');
    chip.className = opts.cls;
    chip.contentEditable = 'false';
    for (const [key, val] of Object.entries(opts.dataAttrs)) {
      chip.dataset[this.camelCase(key)] = val;
    }
    return chip;
  }

  private appendRemoveButton(chip: HTMLSpanElement): void {
    const removeBtn = chip.createSpan({ cls: 'archivist-inline-chip-remove' });
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Capture next sibling before removing (chip detaches from DOM on remove)
      const next = chip.nextSibling;
      chip.remove();
      // Also remove adjacent zero-width space if present
      if (next && next.nodeType === Node.TEXT_NODE && next.textContent === ZERO_WIDTH_SPACE) {
        next.remove();
      }
      this.onInput?.();
    });
  }

  private insertNodeAtCursor(node: Node): void {
    const sel = this.el.win.getSelection();
    if (!sel || sel.rangeCount === 0) {
      this.el.appendChild(node);
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);

    // Move cursor after the inserted node
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  private insertZeroWidthSpace(): void {
    const textNode = this.el.doc.createTextNode(ZERO_WIDTH_SPACE);
    this.insertNodeAtCursor(textNode);
  }

  /** Convert kebab-case to camelCase for dataset keys. */
  private camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
  }

  /** Extract text from a document fragment, serializing chips inline. */
  private extractTextFromFragment(container: HTMLElement): string {
    const parts: string[] = [];

    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push((node.textContent ?? '').replace(/\u200B/g, ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      if (el.tagName === 'BR') {
        parts.push('\n');
        return;
      }

      if (el.classList.contains('archivist-inline-chip')) {
        const entityType = el.dataset.entityType;
        const entityName = el.dataset.entityName;
        const mentionId = el.dataset.mentionId;
        const mentionType = el.dataset.mentionType;
        // File chips are excluded from text (same as serialize)
        if (el.dataset.filePath) return;

        if (entityType && entityName) {
          parts.push(`[[${entityType}:${entityName}]]`);
        } else if (mentionId) {
          if (mentionType === 'agent') {
            parts.push(`@${mentionId} (agent) `);
          } else {
            parts.push(`@${mentionId} `);
          }
        }
        return;
      }

      if (el.tagName === 'DIV' && el.previousSibling) {
        parts.push('\n');
      }

      for (const child of Array.from(el.childNodes)) {
        walk(child);
      }
    };

    for (const child of Array.from(container.childNodes)) {
      walk(child);
    }

    return parts.join('');
  }
}

// ---------------------------------------------------------------------------
// SendButton
// ---------------------------------------------------------------------------

export type SendButtonState = 'idle-empty' | 'idle-ready' | 'streaming';

export class SendButton {
  readonly el: HTMLButtonElement;
  private onSend: () => void;
  private onStop: () => void;
  private currentState: SendButtonState = 'idle-empty';

  constructor(
    container: HTMLElement,
    onSend: () => void,
    onStop: () => void,
  ) {
    this.onSend = onSend;
    this.onStop = onStop;

    this.el = container.createEl('button', {
      cls: 'archivist-send-btn',
      attr: { type: 'button', 'data-state': 'idle-empty' },
    });
    this.el.disabled = true;
    setIcon(this.el, 'arrow-up');

    this.el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.currentState === 'idle-ready') {
        this.onSend();
      } else if (this.currentState === 'streaming') {
        this.onStop();
      }
    });
  }

  setState(state: SendButtonState): void {
    if (state === this.currentState) return;
    this.currentState = state;
    this.el.dataset.state = state;

    switch (state) {
      case 'idle-empty':
        this.el.disabled = true;
        setIcon(this.el, 'arrow-up');
        break;
      case 'idle-ready':
        this.el.disabled = false;
        setIcon(this.el, 'arrow-up');
        break;
      case 'streaming':
        this.el.disabled = false;
        setIcon(this.el, 'square');
        break;
    }
  }
}
