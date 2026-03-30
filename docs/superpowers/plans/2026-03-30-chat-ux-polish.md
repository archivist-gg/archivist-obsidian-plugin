# Chat UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 UX issues in the Archivist Inquiry chat: inline entity/mention chips via contentEditable input, autocomplete Enter priority, send/stop button, UI cleanup (remove permission toggle, navigation sidebar, fix ESC, model names), Copy & Save redesign with saved state, and selectable stat blocks in the Obsidian editor.

**Architecture:** Replace textarea with a contentEditable div (`RichInput`) that renders inline chip elements for `[[` entities and `@` mentions. Autocomplete dropdowns insert chips directly into the rich input. A send/stop button lives inside the input wrapper. UI cleanup removes dead controls (permission toggle, navigation sidebar). Copy & Save gets a subtle-filled button style with saved-state detection via EntityRegistry. A CM6 editor extension enables Backspace/Delete on D&D code block widgets.

**Tech Stack:** TypeScript, Obsidian API, CodeMirror 6, CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/inquiry/features/chat/ui/RichInput.ts` | **Create** | ContentEditable div with chip insertion, serialization, auto-resize, placeholder |
| `src/inquiry/features/chat/tabs/Tab.ts` | Modify | Replace textarea with RichInput, reorder keydown chain, remove entity chips container |
| `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` | Modify | Insert chips into contentEditable instead of manipulating textarea value |
| `src/inquiry/shared/mention/MentionDropdownController.ts` | Modify | Insert chips into contentEditable instead of manipulating textarea value |
| `src/inquiry/features/chat/controllers/InputController.ts` | Modify | Read from RichInput instead of textarea.value |
| `src/inquiry/features/chat/ui/InputToolbar.ts` | Modify | Remove PermissionToggle class and toolbar entry |
| `src/inquiry/features/chat/ui/NavigationSidebar.ts` | **Delete** | Was: 4-button scroll navigation sidebar |
| `src/inquiry/features/chat/controllers/NavigationController.ts` | Modify | Remove sidebar refs, ensure ESC doesn't cancel streaming |
| `src/inquiry/core/types/models.ts` | Modify | Change labels: 'Opus 1M' to 'Opus', 'Sonnet 1M' to 'Sonnet' |
| `src/inquiry/core/agent/QueryOptionsBuilder.ts` | Modify | Hardcode unleashed permission mode |
| `src/inquiry/features/chat/rendering/DndEntityRenderer.ts` | Modify | New button style, saved state detection, file reference link |
| `src/inquiry/features/chat/rendering/MessageRenderer.ts` | Modify | Pass EntityRegistry to replaceDndCodeFences |
| `src/extensions/dnd-block-delete-extension.ts` | **Create** | CM6 keymap for Backspace/Delete on D&D code block widgets |
| `src/main.ts` | Modify | Register the new editor extension |
| `src/inquiry/style/components/input.css` | Modify | ContentEditable styles, send button, inline chip styles |
| `src/inquiry/style/toolbar/permission-toggle.css` | **Delete** | Was: permission toggle switch styles |
| `src/inquiry/style/components/nav-sidebar.css` | **Delete** | Was: navigation sidebar button styles |
| `src/inquiry/style/index.css` | Modify | Remove deleted CSS imports |
| `src/styles/archivist-layout-overrides.css` | Modify | Replace entity-chips with inline-chip styles |
| `src/styles/archivist-dnd.css` | Modify | New action button styles, remove old parchment button |

---

### Task 1: Model Name Labels

**Files:**
- Modify: `src/inquiry/core/types/models.ts:8-14`

- [ ] **Step 1: Change model labels**

In `src/inquiry/core/types/models.ts`, change the `DEFAULT_CLAUDE_MODELS` array labels:

```typescript
export const DEFAULT_CLAUDE_MODELS: { value: ClaudeModel; label: string; description: string }[] = [
  { value: 'haiku', label: 'Haiku', description: 'Fast and efficient' },
  { value: 'sonnet', label: 'Sonnet', description: 'Balanced performance' },
  { value: 'sonnet[1m]', label: 'Sonnet', description: 'Balanced performance (1M context window)' },
  { value: 'opus', label: 'Opus', description: 'Most capable' },
  { value: 'opus[1m]', label: 'Opus', description: 'Most capable (1M context window)' },
];
```

Only the `label` field changes for the `[1m]` variants. The `value` and `description` fields stay the same.

- [ ] **Step 2: Build and verify**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Expected: Build succeeds. Model selector now shows "Opus" and "Sonnet" instead of "Opus 1M" and "Sonnet 1M".

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/core/types/models.ts
git commit -m "fix: model labels show 'Opus'/'Sonnet' instead of 'Opus 1M'/'Sonnet 1M'"
```

---

### Task 2: Remove Permission Toggle

**Files:**
- Modify: `src/inquiry/features/chat/ui/InputToolbar.ts:194-244,894-916`
- Delete: `src/inquiry/style/toolbar/permission-toggle.css`
- Modify: `src/inquiry/style/index.css:26`
- Modify: `src/inquiry/core/agent/QueryOptionsBuilder.ts`

- [ ] **Step 1: Remove PermissionToggle class from InputToolbar.ts**

In `src/inquiry/features/chat/ui/InputToolbar.ts`:

1. Delete the entire `PermissionToggle` class (lines 194-244).

2. In the `createInputToolbar` factory function (lines 894-916), remove the permission toggle creation and the separator before it. Change from:

```typescript
export function createInputToolbar(
  parentEl: HTMLElement,
  callbacks: ToolbarCallbacks
): {
  modelSelector: ModelSelector;
  thinkingBudgetSelector: ThinkingBudgetSelector;
  contextUsageMeter: ContextUsageMeter | null;
  externalContextSelector: ExternalContextSelector;
  mcpServerSelector: McpServerSelector;
  permissionToggle: PermissionToggle;
} {
  const modelSelector = new ModelSelector(parentEl, callbacks);
  parentEl.createDiv({ cls: 'archivist-toolbar-sep' });
  const thinkingBudgetSelector = new ThinkingBudgetSelector(parentEl, callbacks);
  parentEl.createDiv({ cls: 'archivist-toolbar-sep' });
  const contextUsageMeter = new ContextUsageMeter(parentEl);
  const externalContextSelector = new ExternalContextSelector(parentEl, callbacks);
  const mcpServerSelector = new McpServerSelector(parentEl);
  parentEl.createDiv({ cls: 'archivist-toolbar-sep' });
  const permissionToggle = new PermissionToggle(parentEl, callbacks);

  return { modelSelector, thinkingBudgetSelector, contextUsageMeter, externalContextSelector, mcpServerSelector, permissionToggle };
}
```

To:

```typescript
export function createInputToolbar(
  parentEl: HTMLElement,
  callbacks: ToolbarCallbacks
): {
  modelSelector: ModelSelector;
  thinkingBudgetSelector: ThinkingBudgetSelector;
  contextUsageMeter: ContextUsageMeter | null;
  externalContextSelector: ExternalContextSelector;
  mcpServerSelector: McpServerSelector;
} {
  const modelSelector = new ModelSelector(parentEl, callbacks);
  parentEl.createDiv({ cls: 'archivist-toolbar-sep' });
  const thinkingBudgetSelector = new ThinkingBudgetSelector(parentEl, callbacks);
  parentEl.createDiv({ cls: 'archivist-toolbar-sep' });
  const contextUsageMeter = new ContextUsageMeter(parentEl);
  const externalContextSelector = new ExternalContextSelector(parentEl, callbacks);
  const mcpServerSelector = new McpServerSelector(parentEl);

  return { modelSelector, thinkingBudgetSelector, contextUsageMeter, externalContextSelector, mcpServerSelector };
}
```

3. Remove the `PermissionMode` import if it was only used by `PermissionToggle`.

4. In the `ToolbarCallbacks` interface (search for it in the same file), remove `onPermissionModeChange` if it exists, and remove `permissionMode` getter if only used by the toggle.

- [ ] **Step 2: Fix all references to permissionToggle**

Search the codebase for `permissionToggle` references. In `Tab.ts`, there will be code that calls `tab.ui.permissionToggle?.updateDisplay()` or similar. Remove those references. The `ui` object type will need `permissionToggle` removed from it.

Search for files that import or reference `PermissionToggle`:
```bash
cd /Users/shinoobi/w/archivist-obsidian && grep -rn "permissionToggle\|PermissionToggle" src/ --include="*.ts"
```

Fix each reference found.

- [ ] **Step 3: Hardcode unleashed in QueryOptionsBuilder**

In `src/inquiry/core/agent/QueryOptionsBuilder.ts`, find the `applyPermissionMode` method (around line 337-353):

```typescript
private static applyPermissionMode(
  options: Options,
  permissionMode: PermissionMode,
  canUseTool?: CanUseTool
): void {
  options.allowDangerouslySkipPermissions = true;

  if (canUseTool) {
    options.canUseTool = canUseTool;
  }

  if (permissionMode === 'unleashed') {
    options.permissionMode = 'bypassPermissions';
  } else {
    options.permissionMode = 'acceptEdits';
  }
}
```

Change to always use unleashed (remove the conditional):

```typescript
private static applyPermissionMode(
  options: Options,
  canUseTool?: CanUseTool
): void {
  options.allowDangerouslySkipPermissions = true;

  if (canUseTool) {
    options.canUseTool = canUseTool;
  }

  options.permissionMode = 'bypassPermissions';
}
```

Update all call sites of `applyPermissionMode` to remove the `permissionMode` parameter (there are 2 calls -- one in `buildPersistentQueryOptions` around line 224 and one in `buildColdStartQueryOptions` around line 312).

- [ ] **Step 4: Delete permission-toggle.css and remove from index.css**

```bash
rm src/inquiry/style/toolbar/permission-toggle.css
```

In `src/inquiry/style/index.css`, remove line 26:
```css
@import "./toolbar/permission-toggle.css";
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. Toolbar no longer shows Unleashed/Guarded toggle. Permission mode is always bypassed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove permission toggle, always use unleashed mode"
```

---

### Task 3: Remove NavigationSidebar

**Files:**
- Delete: `src/inquiry/features/chat/ui/NavigationSidebar.ts`
- Delete: `src/inquiry/style/components/nav-sidebar.css`
- Modify: `src/inquiry/style/index.css:14`
- Modify: `src/inquiry/features/chat/tabs/Tab.ts:583-587,597-602,606,1093`
- Modify: `src/inquiry/features/chat/controllers/NavigationController.ts`

- [ ] **Step 1: Remove NavigationSidebar instantiation from Tab.ts**

In `src/inquiry/features/chat/tabs/Tab.ts`:

1. Remove the NavigationSidebar import at the top of the file.

2. Remove the instantiation (lines 583-587):
```typescript
// DELETE this block:
if (dom.messagesEl.parentElement) {
  tab.ui.navigationSidebar = new NavigationSidebar(
    dom.messagesEl.parentElement,
    dom.messagesEl
  );
}
```

3. Remove `navigationSidebar` from the `ui` object type and initialization.

4. Remove the callback reference (line 601):
```typescript
// DELETE this line from state.callbacks:
onAutoScrollChanged: () => tab.ui.navigationSidebar?.updateVisibility(),
```

5. Remove the ResizeObserver visibility trigger (around line 606) if it only exists for the sidebar.

6. Remove `navigationSidebar?.updateVisibility()` call in `activateTab()` (around line 1093).

- [ ] **Step 2: Clean up NavigationController sidebar references**

In `src/inquiry/features/chat/controllers/NavigationController.ts`, remove any references to `NavigationSidebar`. The controller itself handles keyboard navigation (j/k/i keys) and ESC -- those stay. Only remove sidebar-specific code if any.

- [ ] **Step 3: Delete the files**

```bash
rm src/inquiry/features/chat/ui/NavigationSidebar.ts
rm src/inquiry/style/components/nav-sidebar.css
```

- [ ] **Step 4: Remove from CSS index**

In `src/inquiry/style/index.css`, remove line 14:
```css
@import "./components/nav-sidebar.css";
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. The 4-button navigation sidebar (scroll top, prev, next, scroll bottom) is gone from the right side of the messages area.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove navigation sidebar (4-button scroll arrows)"
```

---

### Task 4: ESC Only Cancels Streaming When Input Is Focused

**Files:**
- Modify: `src/inquiry/features/chat/tabs/Tab.ts:998-1002`
- Modify: `src/inquiry/features/chat/controllers/NavigationController.ts:126-146`

- [ ] **Step 1: Audit ESC handlers**

The Tab.ts keydown handler is attached to the input element, so it only fires when the input is focused. This is correct.

The NavigationController has its own ESC handler (lines 126-146) that is attached to the input element's keydown. It already has a guard:
```typescript
if (this.deps.isStreaming()) {
  return; // Let existing handler (Tab.ts) deal with it
}
```

This means: if streaming, NavigationController does nothing, and Tab.ts handles ESC to cancel. If not streaming, NavigationController blurs input.

**The issue**: The Tab.ts keydown handler is on `dom.inputEl` (line 1010-1011), so it only fires when the input has focus. Check if there's a **container-level** keydown listener that might also catch ESC.

Search for additional ESC handlers:
```bash
grep -rn "Escape" src/inquiry/features/chat/ --include="*.ts" | grep -v "node_modules"
```

If the only ESC-to-cancel-streaming handler is in Tab.ts on the input element's keydown, then it already only fires when focused. If there are container-level handlers, add a focus check.

- [ ] **Step 2: Add explicit focus guard if needed**

If the Tab.ts keydown is attached to a container element (not the input), change the ESC block to:

```typescript
if (e.key === 'Escape' && !e.isComposing && state.isStreaming) {
  // Only cancel streaming if the input is focused
  if (document.activeElement === dom.inputEl || dom.inputEl.contains(document.activeElement)) {
    e.preventDefault();
    controllers.inputController?.cancelStreaming();
    return;
  }
}
```

If the handler is already on the input element directly (which it is based on line 1010-1011), this guard is unnecessary. Verify and add only if needed.

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: Pressing ESC while reading messages (input not focused) does NOT stop the streaming agent. Pressing ESC while typing in the input DOES stop it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: ESC only cancels streaming when input is focused"
```

---

### Task 5: Create RichInput Component

**Files:**
- Create: `src/inquiry/features/chat/ui/RichInput.ts`

This is the core contentEditable replacement for the textarea. It handles text input, inline chip rendering, serialization, auto-resize, and placeholder text.

- [ ] **Step 1: Create the RichInput class**

Create `src/inquiry/features/chat/ui/RichInput.ts`:

```typescript
import { setIcon } from 'obsidian';

// -- Chip Data Types --

export interface EntityChipData {
  type: 'entity';
  entityType: string;
  name: string;
}

export interface FileChipData {
  type: 'file';
  path: string;
  displayName: string;
}

export interface MentionChipData {
  type: 'mcp-server' | 'agent';
  id: string;
  displayName: string;
  icon: string; // Lucide icon name
}

export type ChipData = EntityChipData | FileChipData | MentionChipData;

// -- Serialization Result --

export interface RichInputContent {
  /** Plain text with entity refs as [[type:Name]] */
  text: string;
  /** Entity references extracted from chips */
  entityRefs: { type: string; name: string }[];
  /** File paths extracted from file chips */
  filePaths: string[];
}

// -- Send/Stop Button --

export type SendButtonState = 'idle-empty' | 'idle-ready' | 'streaming';

export class SendButton {
  readonly el: HTMLButtonElement;
  private state: SendButtonState = 'idle-empty';

  constructor(
    container: HTMLElement,
    private onSend: () => void,
    private onStop: () => void,
  ) {
    this.el = container.createEl('button', {
      cls: 'archivist-send-btn',
      attr: { type: 'button', 'aria-label': 'Send message' },
    });
    this.el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.state === 'idle-ready') {
        this.onSend();
      } else if (this.state === 'streaming') {
        this.onStop();
      }
    });
    this.updateIcon();
  }

  setState(newState: SendButtonState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.el.dataset.state = newState;
    this.el.disabled = newState === 'idle-empty';
    this.el.setAttribute('aria-label', newState === 'streaming' ? 'Stop generation' : 'Send message');
    this.updateIcon();
  }

  private updateIcon(): void {
    this.el.empty();
    if (this.state === 'streaming') {
      setIcon(this.el, 'square');
    } else {
      setIcon(this.el, 'arrow-up');
    }
  }
}

// -- RichInput --

export class RichInput {
  readonly el: HTMLDivElement;
  private placeholder: string;
  onInput?: () => void;

  constructor(container: HTMLElement, options: {
    placeholder?: string;
    onInput?: () => void;
  } = {}) {
    this.placeholder = options.placeholder ?? '';
    this.onInput = options.onInput;

    this.el = container.createDiv({
      cls: 'claudian-rich-input',
      attr: {
        contenteditable: 'true',
        role: 'textbox',
        'aria-multiline': 'true',
        'data-placeholder': this.placeholder,
        dir: 'auto',
      },
    });

    this.el.addEventListener('input', () => {
      this.onInput?.();
    });

    // Paste: strip formatting, insert plain text only
    this.el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, text);
    });

    // Shift+Enter: newline via line break. Plain Enter: let parent handle (send).
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
    });
  }

  // -- Text Access --

  /** Returns the plain text value (no chips, no HTML). */
  get value(): string {
    return this.el.innerText.replace(/\u200B/g, '').trim();
  }

  /** Returns true if the input has no text and no chips. */
  get isEmpty(): boolean {
    if (this.el.querySelector('.archivist-inline-chip')) return false;
    return this.value === '';
  }

  /** Clears all content. */
  clear(): void {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }
  }

  /** Sets plain text content (no chips). */
  setText(text: string): void {
    this.el.textContent = text;
  }

  // -- Chip Insertion --

  /** Inserts an entity chip at the current cursor position. */
  insertEntityChip(entityType: string, name: string): void {
    const chip = this.createChipElement({
      type: 'entity',
      entityType,
      name,
    });
    this.insertNodeAtCursor(chip);
  }

  /** Inserts a file chip at the current cursor position. */
  insertFileChip(path: string, displayName: string): void {
    const chip = this.createChipElement({
      type: 'file',
      path,
      displayName,
    });
    this.insertNodeAtCursor(chip);
  }

  /** Inserts a mention chip (MCP server, agent) at the current cursor position. */
  insertMentionChip(id: string, displayName: string, icon: string, chipType: 'mcp-server' | 'agent'): void {
    const chip = this.createChipElement({
      type: chipType,
      id,
      displayName,
      icon,
    });
    this.insertNodeAtCursor(chip);
  }

  // -- Serialization --

  /** Extracts structured content from the rich input. */
  serialize(): RichInputContent {
    const entityRefs: { type: string; name: string }[] = [];
    const filePaths: string[] = [];
    let text = '';

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += (node.textContent ?? '').replace(/\u200B/g, '');
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      // Handle chip elements
      if (el.classList.contains('archivist-inline-chip')) {
        const eType = el.dataset.entityType;
        const eName = el.dataset.entityName;
        const fPath = el.dataset.filePath;
        const mId = el.dataset.mentionId;

        if (eType && eName) {
          entityRefs.push({ type: eType, name: eName });
          text += `[[${eType}:${eName}]]`;
        } else if (fPath) {
          filePaths.push(fPath);
          // File paths go into attachedFiles, not text
        } else if (mId) {
          const mType = el.dataset.mentionType;
          if (mType === 'agent') {
            text += `@${mId} (agent) `;
          } else {
            text += `@${mId} `;
          }
        }
        return; // Don't recurse into chip children
      }

      // Handle line breaks
      if (el.tagName === 'BR') {
        text += '\n';
        return;
      }

      // Handle div-as-line (contentEditable sometimes wraps lines in divs)
      if (el.tagName === 'DIV' && el.previousSibling) {
        text += '\n';
      }

      for (const child of el.childNodes) {
        walk(child);
      }
    };

    walk(this.el);

    return {
      text: text.trim(),
      entityRefs,
      filePaths,
    };
  }

  // -- Text Manipulation (for autocomplete) --

  /** Returns the text content before the cursor position. */
  getTextBeforeCursor(): string {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return '';

    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);

    const preRange = document.createRange();
    preRange.setStart(this.el, 0);
    preRange.setEnd(range.startContainer, range.startOffset);

    const fragment = preRange.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    return tempDiv.textContent ?? '';
  }

  /** Removes N characters before the cursor. */
  removeTextBeforeCursor(count: number): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    for (let i = 0; i < count; i++) {
      sel.modify('extend', 'backward', 'character');
    }
    document.execCommand('delete', false);
  }

  /** Focus the input. */
  focus(): void {
    this.el.focus();
  }

  /** Blur the input. */
  blur(): void {
    this.el.blur();
  }

  // -- Cursor Position (for autocomplete compat) --

  /** Approximate cursor offset from start of text content. */
  get selectionStart(): number {
    return this.getTextBeforeCursor().length;
  }

  // -- Private --

  private createChipElement(data: ChipData): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = 'archivist-inline-chip';
    chip.contentEditable = 'false';

    if (data.type === 'entity') {
      chip.dataset.entityType = data.entityType;
      chip.dataset.entityName = data.name;
      chip.createSpan({ cls: 'archivist-inline-chip-type', text: data.entityType.toUpperCase() });
      chip.createSpan({ cls: 'archivist-inline-chip-name', text: data.name });
    } else if (data.type === 'file') {
      chip.dataset.filePath = data.path;
      chip.classList.add('archivist-inline-chip-file');
      const iconSpan = chip.createSpan({ cls: 'archivist-inline-chip-icon' });
      setIcon(iconSpan, 'file-text');
      chip.createSpan({ cls: 'archivist-inline-chip-name', text: data.displayName });
    } else {
      chip.dataset.mentionId = data.id;
      chip.dataset.mentionType = data.type;
      const iconSpan = chip.createSpan({ cls: 'archivist-inline-chip-icon' });
      setIcon(iconSpan, data.icon);
      chip.createSpan({ cls: 'archivist-inline-chip-name', text: data.displayName });
    }

    // Remove button
    const removeBtn = chip.createSpan({ cls: 'archivist-inline-chip-remove', text: '\u00d7' });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove adjacent zero-width space if present
      const next = chip.nextSibling;
      if (next?.nodeType === Node.TEXT_NODE && next.textContent === '\u200B') {
        next.remove();
      }
      chip.remove();
      this.onInput?.();
    });

    return chip;
  }

  private insertNodeAtCursor(node: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      this.el.appendChild(node);
      this.el.appendChild(document.createTextNode('\u200B'));
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);

    // Add zero-width space after chip for cursor positioning
    const spacer = document.createTextNode('\u200B');
    node.after(spacer);

    // Move cursor after the spacer
    const newRange = document.createRange();
    newRange.setStartAfter(spacer);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    this.onInput?.();
  }
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. The class is created but not yet wired into the UI.

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/features/chat/ui/RichInput.ts
git commit -m "feat: create RichInput contentEditable component with SendButton"
```

---

### Task 6: Wire RichInput into Tab.ts and InputController

**Files:**
- Modify: `src/inquiry/features/chat/tabs/Tab.ts`
- Modify: `src/inquiry/features/chat/controllers/InputController.ts`

This is the largest task. It replaces the textarea with RichInput, updates the keydown chain, adds the send button, and updates InputController to read from the rich input.

- [ ] **Step 1: Replace textarea creation with RichInput in buildTabDOM**

In `src/inquiry/features/chat/tabs/Tab.ts`, change the `buildTabDOM` function (lines 176-225).

Replace the textarea creation (lines 201-208):
```typescript
// OLD:
const inputEl = inputWrapper.createEl('textarea', {
  cls: 'claudian-input',
  attr: {
    placeholder: 'Ask the Archivist... (@ files, [[ entities, / commands)',
    rows: '3',
    dir: 'auto',
  },
});
```

With RichInput:
```typescript
// NEW:
const richInput = new RichInput(inputWrapper, {
  placeholder: 'Ask the Archivist... (@ files, [[ entities, / commands)',
});
const inputEl = richInput.el;
```

Add the import at the top:
```typescript
import { RichInput, SendButton } from '../ui/RichInput';
```

Update the `TabDOMElements` interface to include `richInput` and change `inputEl` type from `HTMLTextAreaElement` to `HTMLDivElement`. Return `richInput` in the TabDOMElements object.

- [ ] **Step 2: Add SendButton to input wrapper**

In the tab initialization function (where controllers are set up), create the send button:
```typescript
tab.ui.sendButton = new SendButton(
  dom.inputWrapper,
  () => void controllers.inputController?.sendMessage(),
  () => controllers.inputController?.cancelStreaming(),
);
```

Update the streaming state callback to also update the send button:
```typescript
onStreamingStateChanged: (isStreaming) => {
  onStreamingChanged?.(isStreaming);
  tab.ui.sendButton?.setState(isStreaming ? 'streaming' : (dom.richInput.isEmpty ? 'idle-empty' : 'idle-ready'));
},
```

Wire the `onInput` callback of RichInput to update the send button state:
```typescript
dom.richInput.onInput = () => {
  tab.ui.sendButton?.setState(
    state.isStreaming ? 'streaming' : (dom.richInput.isEmpty ? 'idle-empty' : 'idle-ready')
  );
  // Trigger existing input handlers
  ui.fileContextManager?.handleInputChange();
  ui.entityAutocomplete?.handleInput();
  autoResizeRichInput(dom.richInput.el);
};
```

- [ ] **Step 3: Remove entity chips container from context row**

In Tab.ts, remove the entity chips container creation (lines 553-554):
```typescript
// DELETE:
const entityChipsEl = dom.contextRowEl.createDiv({ cls: 'archivist-entity-chips' });
entityChipsEl.style.display = 'none';
```

Remove the `entityRefs` array and chip creation callback. Entity chips now live inline via RichInput.

Update the EntityAutocompleteDropdown creation to use RichInput's insertEntityChip:
```typescript
tab.ui.entityAutocomplete = new EntityAutocompleteDropdown(
  dom.inputContainerEl,
  dom.richInput,       // Pass RichInput instead of textarea
  plugin.entityRegistry,
  (entityType: string, name: string) => {
    dom.richInput.insertEntityChip(entityType, name);
  },
);
```

- [ ] **Step 4: Verify keydown chain order**

The keydown handler in Tab.ts (lines 959-1008) already checks all dropdowns before Enter-to-send. The current order is:

1. Bang-bash mode -> 2. Instruction triggers -> 3. Bang-bash trigger -> 4. Instruction keydown -> 5. Resume dropdown -> 6. Slash commands -> 7. File mentions -> 8. Entity autocomplete -> **9. ESC cancel** -> **10. Enter send**

All dropdown handlers (steps 5-8) return `true` when they consume Enter, preventing step 10 from running. Verify that the `handleKeydown` methods correctly consume Enter when visible:
- `EntityAutocompleteDropdown.handleKeydown`: Returns `true` for Enter when `this._isVisible && this.results.length > 0`
- `MentionDropdownController.handleKeydown`: Returns `true` for Enter when `!e.isComposing`

No reorder needed -- confirm and move on.

- [ ] **Step 5: Update autoResizeTextarea for contentEditable**

Rename and adapt the existing function:

```typescript
function autoResizeRichInput(el: HTMLElement): void {
  el.style.minHeight = '';

  const viewHeight = el.closest('.claudian-container')?.clientHeight ?? window.innerHeight;
  const maxHeight = Math.max(TEXTAREA_MIN_MAX_HEIGHT, viewHeight * TEXTAREA_MAX_HEIGHT_PERCENT);
  const flexAllocatedHeight = el.offsetHeight;
  const contentHeight = Math.min(el.scrollHeight, maxHeight);

  if (contentHeight > flexAllocatedHeight) {
    el.style.minHeight = `${contentHeight}px`;
  }
  el.style.maxHeight = `${maxHeight}px`;
}
```

- [ ] **Step 6: Update InputController to read from RichInput**

In `src/inquiry/features/chat/controllers/InputController.ts`:

1. Add `richInput: RichInput` to the InputController deps interface.

2. In `sendMessage` (line 131), change:
```typescript
// OLD:
const content = (contentOverride ?? inputEl.value).trim();

// NEW:
const serialized = contentOverride ? null : this.deps.richInput.serialize();
const content = (contentOverride ?? serialized?.text ?? '').trim();
```

3. Use `serialized.entityRefs` instead of the old `entityRefs` array from Tab.ts.

4. Use `serialized.filePaths` to add to attached files.

5. When clearing input after send (line 181-182):
```typescript
// OLD:
inputEl.value = '';
this.deps.resetInputHeight();

// NEW:
this.deps.richInput.clear();
this.deps.resetInputHeight();
```

6. Update `restoreQueuedMessageToInput()` and any other place that writes to `inputEl.value` -- change to `richInput.setText()`.

- [ ] **Step 7: Build and verify**

```bash
npm run build
```

Expected: The chat input is now a contentEditable div. Typing works, Shift+Enter creates newlines, Enter sends messages, paste strips formatting. Send button shows arrow-up/stop states.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire RichInput and SendButton into Tab.ts and InputController"
```

---

### Task 7: Update EntityAutocompleteDropdown for ContentEditable

**Files:**
- Modify: `src/inquiry/shared/components/EntityAutocompleteDropdown.ts`

- [ ] **Step 1: Update EntityAutocompleteDropdown to work with RichInput**

The dropdown currently stores `this.inputEl` as `HTMLTextAreaElement` and reads `this.inputEl.value` and `this.inputEl.selectionStart`.

In `src/inquiry/shared/components/EntityAutocompleteDropdown.ts`:

1. Add the import:
```typescript
import type { RichInput } from '../../features/chat/ui/RichInput';
```

2. Change the constructor signature:
```typescript
// OLD:
constructor(
  containerEl: HTMLElement,
  inputEl: HTMLTextAreaElement,
  entityRegistry: EntityRegistry,
  onSelect?: (entityType: string, name: string) => void,
)

// NEW:
constructor(
  containerEl: HTMLElement,
  richInput: RichInput,
  entityRegistry: EntityRegistry,
  onSelect?: (entityType: string, name: string) => void,
)
```

3. Store `richInput` instead of `inputEl`:
```typescript
private richInput: RichInput;
```

4. In `handleInput()`, change to use `richInput.getTextBeforeCursor()`:
```typescript
// OLD:
const text = this.inputEl.value;
const cursorPos = this.inputEl.selectionStart || 0;

// NEW:
const textBeforeCursor = this.richInput.getTextBeforeCursor();
const bracketIndex = textBeforeCursor.lastIndexOf('[[');
```

5. In `selectItem()`, instead of manipulating `this.inputEl.value`:
```typescript
// OLD:
const text = this.inputEl.value;
const cursorPos = this.inputEl.selectionStart || 0;
const beforeBrackets = text.substring(0, this.bracketStartIndex);
const afterCursor = text.substring(cursorPos);
this.inputEl.value = beforeBrackets + afterCursor;

// NEW:
const charsToRemove = this.richInput.selectionStart - this.bracketStartIndex;
this.richInput.removeTextBeforeCursor(charsToRemove);
```

Then call the `onSelect` callback (which inserts the chip via `RichInput.insertEntityChip`).

6. Update the input event listener:
```typescript
// OLD:
this.inputEl.addEventListener('input', () => this.debouncedHandleInput());

// NEW:
this.richInput.el.addEventListener('input', () => this.debouncedHandleInput());
```

7. Update focus calls:
```typescript
// OLD: this.inputEl.focus();
// NEW: this.richInput.focus();
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: `[[` typing shows the entity dropdown. Selecting an item inserts an inline chip in the contentEditable div. The `[[query` text is removed. Cursor is placed after the chip.

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/shared/components/EntityAutocompleteDropdown.ts
git commit -m "feat: EntityAutocompleteDropdown inserts inline chips via RichInput"
```

---

### Task 8: Update MentionDropdownController for ContentEditable

**Files:**
- Modify: `src/inquiry/shared/mention/MentionDropdownController.ts`

- [ ] **Step 1: Update MentionDropdownController to work with RichInput**

1. Add the import:
```typescript
import type { RichInput } from '../../features/chat/ui/RichInput';
```

2. Change the constructor to accept `RichInput` instead of `HTMLTextAreaElement`:
```typescript
private richInput: RichInput;
```

3. Update `handleInputChange()` to use `richInput.getTextBeforeCursor()`:
```typescript
// OLD:
const text = this.inputEl.value;
const cursorPos = this.inputEl.selectionStart || 0;

// NEW:
const textBeforeCursor = this.richInput.getTextBeforeCursor();
```

4. Replace `insertReplacement()` (lines 553-556):
```typescript
// OLD:
private insertReplacement(beforeAt: string, replacement: string, afterCursor: string): void {
  this.inputEl.value = beforeAt + replacement + afterCursor;
  this.inputEl.selectionStart = this.inputEl.selectionEnd = beforeAt.length + replacement.length;
}

// NEW:
private insertReplacement(charsToRemove: number, replacement: string): void {
  this.richInput.removeTextBeforeCursor(charsToRemove);
  if (replacement) {
    document.execCommand('insertText', false, replacement);
  }
}
```

5. Update `selectMentionItem()` for each type. For files:
```typescript
// context-file and default (file):
const charsToRemove = this.richInput.selectionStart - this.mentionStartIndex;
this.richInput.removeTextBeforeCursor(charsToRemove);
if (normalizedPath) {
  this.richInput.insertFileChip(normalizedPath, selectedItem.name);
  this.callbacks.onAttachFile(normalizedPath);
}
```

For MCP servers:
```typescript
const charsToRemove = this.richInput.selectionStart - this.mentionStartIndex;
this.richInput.removeTextBeforeCursor(charsToRemove);
this.richInput.insertMentionChip(selectedItem.name, selectedItem.name, 'server', 'mcp-server');
this.callbacks.addMentionedMcpServer(selectedItem.name);
```

For agents:
```typescript
const charsToRemove = this.richInput.selectionStart - this.mentionStartIndex;
this.richInput.removeTextBeforeCursor(charsToRemove);
this.richInput.insertMentionChip(selectedItem.id, selectedItem.name ?? selectedItem.id, 'bot', 'agent');
this.callbacks.onAgentMentionSelect?.(selectedItem.id);
```

For entity and folder types that remain as text:
```typescript
const charsToRemove = this.richInput.selectionStart - this.mentionStartIndex;
this.richInput.removeTextBeforeCursor(charsToRemove);
document.execCommand('insertText', false, `@${selectedItem.name} `);
```

6. Update all event listener attachments from `this.inputEl` to `this.richInput.el`.

7. Update focus calls from `this.inputEl.focus()` to `this.richInput.focus()`.

- [ ] **Step 2: Update FileContextManager to pass RichInput**

The `FileContextManager` creates the `MentionDropdownController` internally. Find where it passes the textarea and change it to pass the RichInput instance. Update the `FileContextManager` constructor in Tab.ts accordingly.

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: `@` typing shows the mention dropdown. Selecting a file inserts an inline file chip. Selecting an MCP server inserts an MCP chip. All chips have remove buttons.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: MentionDropdownController inserts inline chips via RichInput"
```

---

### Task 9: CSS for Rich Input and Inline Chips

**Files:**
- Modify: `src/inquiry/style/components/input.css`
- Modify: `src/styles/archivist-layout-overrides.css`

- [ ] **Step 1: Add contentEditable and send button styles to input.css**

In `src/inquiry/style/components/input.css`, add after the existing `.claudian-input` block (keep old for any remaining refs):

```css
/* Rich input (contentEditable div replacing textarea) */
.claudian-rich-input {
  width: 100%;
  flex: 1 1 0;
  min-height: 60px;
  padding: 8px 40px 10px 10px; /* Right padding for send button */
  border: none !important;
  border-radius: 6px;
  background: transparent !important;
  color: var(--text-normal);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  box-shadow: none !important;
  overflow-y: auto;
  outline: none !important;
  white-space: pre-wrap;
  word-wrap: break-word;
  unicode-bidi: plaintext;
}

.claudian-rich-input:hover,
.claudian-rich-input:focus {
  outline: none !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* Placeholder via data attribute */
.claudian-rich-input:empty::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}

/* Send/Stop button */
.archivist-send-btn {
  position: absolute;
  bottom: 44px; /* Above the toolbar */
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--background-modifier-hover);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  z-index: 1;
  padding: 0;
}

.archivist-send-btn svg {
  width: 16px;
  height: 16px;
}

.archivist-send-btn[data-state="idle-ready"] {
  background: var(--claudian-brand);
  color: #fff;
}

.archivist-send-btn[data-state="idle-ready"]:hover {
  filter: brightness(1.1);
}

.archivist-send-btn[data-state="streaming"] {
  background: var(--claudian-brand);
  color: #fff;
}

.archivist-send-btn[data-state="streaming"]:hover {
  filter: brightness(1.1);
}

.archivist-send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Monospace input while in bash mode (updated for rich input) */
.claudian-input-wrapper.claudian-input-bang-bash-mode .claudian-rich-input {
  font-family: var(--font-monospace);
}
```

- [ ] **Step 2: Replace entity chips with inline chip styles in archivist-layout-overrides.css**

In `src/styles/archivist-layout-overrides.css`, replace the `archivist-entity-chips` section (lines 44-55) with:

```css
/* Inline chips (inside contentEditable rich input) */
.archivist-inline-chip {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 6px; border-radius: 10px;
  background: rgba(var(--claudian-brand-rgb, 217,119,87), 0.12);
  font-size: 11px; vertical-align: baseline;
  cursor: default; white-space: nowrap;
  user-select: none; line-height: 1.4;
}
.archivist-inline-chip-type {
  color: var(--claudian-brand); font-weight: 600;
  text-transform: uppercase; font-size: 9px;
}
.archivist-inline-chip-name {
  color: var(--text-normal);
}
.archivist-inline-chip-file {
  background: var(--background-secondary);
}
.archivist-inline-chip-icon {
  display: inline-flex; align-items: center;
}
.archivist-inline-chip-icon svg { width: 12px; height: 12px; }
.archivist-inline-chip-remove {
  cursor: pointer; color: var(--text-faint);
  margin-left: 2px; font-size: 13px; line-height: 1;
}
.archivist-inline-chip-remove:hover { color: var(--text-normal); }
```

- [ ] **Step 3: Update layout override for rich input font size**

In `archivist-layout-overrides.css`, update the textarea font override (line 20-22):
```css
/* OLD: */
.claudian-input-container textarea {
  font-size: 13px;
}

/* NEW: */
.claudian-input-container .claudian-rich-input {
  font-size: 13px;
}
```

- [ ] **Step 4: Build CSS and verify**

```bash
npm run build:css && npm run build
```

Expected: Build succeeds. Rich input renders properly. Inline chips have styled pill appearance. Send button appears at bottom-right of input.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: CSS for rich input, inline chips, and send/stop button"
```

---

### Task 10: Copy & Save Button Redesign

**Files:**
- Modify: `src/inquiry/features/chat/rendering/DndEntityRenderer.ts`
- Modify: `src/inquiry/features/chat/rendering/MessageRenderer.ts`
- Modify: `src/styles/archivist-dnd.css`

- [ ] **Step 1: Update DndEntityRenderer with new button and saved state**

In `src/inquiry/features/chat/rendering/DndEntityRenderer.ts`:

1. Add imports:
```typescript
import type { App } from 'obsidian';
import type { EntityRegistry } from '../../../../entities/entity-registry';
```

2. Change `renderDndEntityBlock` signature:
```typescript
export function renderDndEntityBlock(
  containerEl: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
): void {
```

3. Replace the button rendering section (after the stat block, around line 68-80) with:
```typescript
  if (onCopyAndSave) {
    const actionsEl = wrapper.createDiv({ cls: 'claudian-dnd-actions' });

    // Check if entity is already saved
    const existingEntity = entityRegistry
      ? entityRegistry.search(result.name, result.entityType, 1)
          .find(e => e.source === 'custom')
      : null;

    if (existingEntity) {
      // Saved state: Copy button + file reference
      const btn = actionsEl.createEl('button', { cls: 'archivist-dnd-action-btn' });
      const iconSpan = btn.createSpan();
      setIcon(iconSpan, 'copy');
      btn.createSpan({ text: 'Copy' });
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(
            '```' + result.entityType + '\n' + result.yamlSource + '\n```'
          );
          const label = btn.querySelector('span:last-child');
          if (label) {
            label.textContent = 'Copied!';
            setTimeout(() => { label.textContent = 'Copy'; }, 2000);
          }
        } catch { /* clipboard may fail */ }
      });

      const refEl = actionsEl.createDiv({ cls: 'archivist-dnd-file-ref' });
      const linkIcon = refEl.createSpan({ cls: 'archivist-dnd-file-ref-icon' });
      setIcon(linkIcon, 'link');
      refEl.createSpan({ text: existingEntity.filePath });
      refEl.addEventListener('click', () => {
        if (app) {
          app.workspace.openLinkText(existingEntity.filePath, '', false);
        }
      });
    } else {
      // Unsaved state: Copy & Save button
      const btn = actionsEl.createEl('button', { cls: 'archivist-dnd-action-btn' });
      const iconSpan = btn.createSpan();
      setIcon(iconSpan, 'save');
      btn.createSpan({ text: 'Copy & Save' });
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(
            '```' + result.entityType + '\n' + result.yamlSource + '\n```'
          );
        } catch { /* clipboard may fail */ }
        onCopyAndSave(result.entityType, result.yamlSource, result.name);

        // Transition to saved state
        actionsEl.empty();
        const savedBtn = actionsEl.createEl('button', { cls: 'archivist-dnd-action-btn' });
        const savedIconSpan = savedBtn.createSpan();
        setIcon(savedIconSpan, 'copy');
        savedBtn.createSpan({ text: 'Copy' });
        savedBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(
              '```' + result.entityType + '\n' + result.yamlSource + '\n```'
            );
            const label = savedBtn.querySelector('span:last-child');
            if (label) {
              label.textContent = 'Copied!';
              setTimeout(() => { label.textContent = 'Copy'; }, 2000);
            }
          } catch { /* clipboard may fail */ }
        });
      });
    }
  }
```

4. Update `replaceDndCodeFences` signature:
```typescript
export function replaceDndCodeFences(
  el: HTMLElement,
  onCopyAndSave?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
): void {
  // ... existing scanning logic ...
  renderDndEntityBlock(container, result, onCopyAndSave, entityRegistry, app);
}
```

- [ ] **Step 2: Update MessageRenderer to pass EntityRegistry and App**

In `src/inquiry/features/chat/rendering/MessageRenderer.ts`, change the `replaceDndCodeFences` call (line 539):

```typescript
// OLD:
replaceDndCodeFences(el, this.dndCopyAndSaveCallback);

// NEW:
replaceDndCodeFences(
  el,
  this.dndCopyAndSaveCallback,
  this.plugin.entityRegistry as EntityRegistry | null,
  this.app,
);
```

Add the EntityRegistry import:
```typescript
import type { EntityRegistry } from '../../../../entities/entity-registry';
```

- [ ] **Step 3: Update archivist-dnd.css**

In `src/styles/archivist-dnd.css`, replace the old button styles (the `.claudian-dnd-copy-save-btn` block and `.claudian-dnd-actions` block) with:

```css
/* D&D entity block actions */
.claudian-dnd-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0 4px;
}

/* Action button (Copy & Save / Copy) */
.archivist-dnd-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 18px;
  border: none;
  border-radius: 6px;
  background: var(--background-modifier-hover);
  color: var(--text-muted);
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.archivist-dnd-action-btn:hover {
  background: rgba(var(--claudian-brand-rgb, 217,119,87), 0.15);
  color: var(--claudian-brand);
}

.archivist-dnd-action-btn svg {
  width: 14px;
  height: 14px;
}

/* File reference link below saved button */
.archivist-dnd-file-ref {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-style: italic;
  color: var(--text-faint);
  cursor: pointer;
}

.archivist-dnd-file-ref:hover {
  color: var(--text-muted);
}

.archivist-dnd-file-ref-icon svg {
  width: 10px;
  height: 10px;
}
```

Delete the old `.claudian-dnd-copy-save-btn` and related rules.

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: D&D stat blocks show a subtle-filled "Copy & Save" button centered below. Already-saved entities show "Copy" + file reference link.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: redesign Copy & Save with subtle-filled style and saved state detection"
```

---

### Task 11: D&D Block Delete Extension for Obsidian Editor

**Files:**
- Create: `src/extensions/dnd-block-delete-extension.ts`
- Modify: `src/main.ts:93-94`

- [ ] **Step 1: Create the CM6 editor extension**

Create `src/extensions/dnd-block-delete-extension.ts`:

```typescript
import { syntaxTree } from '@codemirror/language';
import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

const DND_LANGUAGES = new Set(['monster', 'spell', 'item']);

/**
 * Finds the full range of a fenced code block if the cursor
 * is at or adjacent to a D&D code block in the document.
 */
function findDndCodeBlockRange(view: EditorView): { from: number; to: number } | null {
  const { state } = view;
  const { from, to } = state.selection.main;

  let blockRange: { from: number; to: number } | null = null;

  syntaxTree(state).iterate({
    from: Math.max(0, from - 1),
    to: Math.min(state.doc.length, to + 1),
    enter(node) {
      if (blockRange) return false;

      // CM6 markdown parser uses "FencedCode" for fenced code blocks
      if (!node.type.name.includes('FencedCode')) return;

      // Check if this is a D&D language block
      const blockStart = state.doc.sliceString(node.from, Math.min(node.from + 30, node.to));
      const langMatch = blockStart.match(/^```(\w+)/);
      if (!langMatch || !DND_LANGUAGES.has(langMatch[1])) return;

      // Check if cursor is at or near this block boundary
      const isAtBefore = from >= node.from - 1 && from <= node.from + 1;
      const isAtAfter = from >= node.to - 1 && from <= node.to + 1;
      const isOverlapping = from <= node.to && to >= node.from;

      if (isAtBefore || isAtAfter || isOverlapping) {
        let rangeFrom = node.from;
        let rangeTo = node.to;

        // Include leading newline
        if (rangeFrom > 0 && state.doc.sliceString(rangeFrom - 1, rangeFrom) === '\n') {
          rangeFrom--;
        }
        // Include trailing newline
        if (rangeTo < state.doc.length && state.doc.sliceString(rangeTo, rangeTo + 1) === '\n') {
          rangeTo++;
        }

        blockRange = { from: rangeFrom, to: rangeTo };
      }
    },
  });

  return blockRange;
}

function handleDeleteKey(view: EditorView): boolean {
  const range = findDndCodeBlockRange(view);
  if (!range) return false;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: '' },
  });
  return true;
}

/**
 * CM6 keymap extension that enables Backspace/Delete to remove
 * entire D&D code blocks (monster, spell, item) when the cursor
 * is at the block boundary in Obsidian's live preview.
 */
export const dndBlockDeleteKeymap = keymap.of([
  { key: 'Backspace', run: handleDeleteKey },
  { key: 'Delete', run: handleDeleteKey },
]);
```

- [ ] **Step 2: Register in main.ts**

In `src/main.ts`, add the import after line 22:

```typescript
import { dndBlockDeleteKeymap } from './extensions/dnd-block-delete-extension';
```

After line 94 (`this.registerEditorExtension(inlineTagPlugin);`), add:

```typescript
this.registerEditorExtension(dndBlockDeleteKeymap);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. In Obsidian editor, cursor at a D&D stat block + Backspace/Delete removes the entire code block.

- [ ] **Step 4: Commit**

```bash
git add src/extensions/dnd-block-delete-extension.ts src/main.ts
git commit -m "feat: Backspace/Delete removes D&D code blocks in Obsidian editor"
```

---

### Task 12: Deploy and Final Verification

**Files:**
- None (build + deploy step)

- [ ] **Step 1: Full build**

```bash
cd /Users/shinoobi/w/archivist-obsidian
npm run build
```

- [ ] **Step 2: Deploy to plugin directory**

```bash
cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/
```

- [ ] **Step 3: Verify all 10 issues in Obsidian**

Reload Obsidian and verify:
1. `[[` selection creates inline chips in the input (not above)
2. `@` selection creates inline chips in the input
3. Enter selects autocomplete option (doesn't send)
4. No Unleashed/Guarded toggle in toolbar
5. ESC only cancels streaming when input is focused
6. Send button visible (arrow-up / stop square)
7. Model shows "Opus" not "Opus 1M"
8. No navigation sidebar arrows
9. Copy & Save button has subtle-filled style
10. Already-saved entities show "Copy" + file ref
11. D&D blocks deletable with Backspace/Delete in editor

- [ ] **Step 4: Commit if any final fixes needed**

```bash
git add -A
git commit -m "fix: final polish adjustments"
```
