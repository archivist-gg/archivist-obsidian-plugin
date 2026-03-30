# Chat UX Polish Design Spec

**Goal:** Fix 10 UX issues in the Archivist Inquiry chat — from input behavior to entity block interactions.

**Scope:** Input system rewrite (contentEditable), UI cleanup (remove dead controls), Copy & Save button redesign, and selectable stat blocks in the Obsidian editor.

---

## Section 1: Rich Input with ContentEditable

Replace the `<textarea>` in the chat input with a `contentEditable` div to support inline chips, proper autocomplete behavior, and a send/stop button.

### 1.1 RichInput Component

**New class: `RichInput`** (replaces direct textarea usage in `Tab.ts`)

- A `contentEditable` div with `role="textbox"` and `aria-multiline="true"`
- Placeholder text via CSS `::before` pseudo-element on `:empty` state
- Emits a `change` event when content changes (via `input` event listener)
- Supports Shift+Enter for newlines (inserts `<br>`)
- On paste: strip all formatting, insert plain text only (`e.clipboardData.getData('text/plain')`)

### 1.2 Inline Entity Chips

When the user selects an entity from the `[[` autocomplete dropdown:

1. Remove the `[[query` text from the contentEditable div
2. Insert a non-editable inline chip element at the cursor position:
   ```html
   <span class="archivist-inline-chip" contenteditable="false" data-entity-type="monster" data-entity-name="Fire Giant">
     <span class="archivist-inline-chip-type">MONSTER</span>
     <span class="archivist-inline-chip-name">Fire Giant</span>
     <span class="archivist-inline-chip-remove">&times;</span>
   </span>
   ```
3. Place cursor after the chip with a zero-width space for continued typing

**Remove** the `archivist-entity-chips` container in the context row. Chips live inline now.

### 1.3 Inline @ Mention Chips

When the user selects a file from the `@` mention dropdown:

1. Remove the `@query` text from the contentEditable div
2. Insert a non-editable inline chip:
   ```html
   <span class="archivist-inline-chip archivist-inline-chip-file" contenteditable="false" data-file-path="/path/to/file">
     <span class="archivist-inline-chip-icon">[file-text svg]</span>
     <span class="archivist-inline-chip-name">filename.md</span>
     <span class="archivist-inline-chip-remove">&times;</span>
   </span>
   ```
3. Other mention types (MCP servers, agents) also render as inline chips with appropriate icons

**All @ mention types render as inline chips** — files get file-text icon, MCP servers get server icon, agents get bot icon. Consistent chip treatment for everything selected from the @ dropdown.

### 1.4 Message Extraction

When sending a message, serialize the contentEditable div back to plain text:

- Chip elements with `data-entity-type` + `data-entity-name` serialize to `[[type:Name]]`
- Chip elements with `data-file-path` serialize to the file path for the `attachedFiles` array
- `<br>` elements serialize to `\n`
- All other HTML stripped, text content extracted
- Entity chips produce `entityRefs` array entries (same as current behavior)
- File chips produce `attachedFiles` entries (same as current `onAttachFile` behavior)

### 1.5 Autocomplete Enter Priority

In the keydown handler chain in Tab.ts, **reorder** so that all autocomplete dropdowns are checked before the send action:

```
1. Bang-bash mode check
2. Instruction mode triggers
3. Resume dropdown keydown
4. Slash command dropdown keydown
5. File/mention dropdown keydown
6. Entity autocomplete keydown
7. ← ALL above return true if they consume Enter
8. Enter to send (only reached if no dropdown consumed it)
9. Escape handling
```

The key change: if any dropdown's `handleKeydown()` returns `true` for Enter, the event is consumed and `sendMessage()` is never called.

### 1.6 Send/Stop Button

A button rendered inside the input container, positioned at the bottom-right of the input area:

**States:**
- `idle-empty`: Arrow-up icon, disabled (grayed out). Input is empty, not streaming.
- `idle-ready`: Arrow-up icon, enabled (brand color). Input has text, not streaming. Click sends.
- `streaming`: Square/stop icon, enabled (brand color). Click cancels streaming.

**HTML structure:**
```html
<div class="claudian-input-container">
  <div class="claudian-input-wrapper">
    <div class="claudian-rich-input" contenteditable="true"></div>
    <button class="archivist-send-btn" data-state="idle-empty">
      <svg><!-- arrow-up or square icon --></svg>
    </button>
  </div>
</div>
```

**CSS:** Absolutely positioned bottom-right within the input wrapper, 28x28px circle, transitions between states.

---

## Section 2: UI Cleanup

### 2.1 Remove Permission Toggle (Issue 3)

- Delete `PermissionToggle` class from `InputToolbar.ts`
- Remove permission toggle rendering from toolbar
- Hardcode `permissionMode: 'unleashed'` — always bypass permissions
- Remove `permissionMode` from user-facing settings UI (keep in `ClaudianSettings` type for storage compatibility but never expose it)
- Remove `permission-toggle.css`

### 2.2 ESC Only When Input Focused (Issue 4)

In Tab.ts, the ESC keydown handler that cancels streaming:

```typescript
if (e.key === 'Escape' && !e.isComposing && state.isStreaming) {
  e.preventDefault();
  controllers.inputController?.cancelStreaming();
  return;
}
```

This handler is on the input element's keydown, so it only fires when input is focused. **However**, there may be a document-level or container-level ESC listener. Audit all ESC handlers:

- Tab.ts input keydown: Keep (only fires when input focused)
- NavigationController ESC handler: Ensure it does NOT cancel streaming — it should only blur input/focus messages
- Any document-level ESC listeners: Remove streaming cancel from them

The result: pressing ESC while reading messages (input not focused) does nothing to the stream. Only ESC while typing in the input cancels.

### 2.3 Model Names (Issue 6)

In `src/inquiry/core/types/models.ts`, change labels:

- `'Opus 1M'` → `'Opus'`
- `'Sonnet 1M'` → `'Sonnet'`

Keep the `value` field (`'opus[1m]'`, `'sonnet[1m]'`) unchanged — only the display label changes. The 1M context window is the default for both models, no need to call it out.

### 2.4 Remove NavigationSidebar (Issue 7)

- Delete `src/inquiry/features/chat/ui/NavigationSidebar.ts`
- Remove all imports and instantiation of NavigationSidebar (likely in Tab.ts or ClaudianView.ts)
- Remove associated CSS for the 4-button navigation sidebar
- Users rely on natural scrolling and the existing scroll-to-bottom button (if any) or just scroll

---

## Section 3: Copy & Save Button Redesign

### 3.1 Button Style: Subtle Filled

Replace the current parchment-styled `claudian-dnd-copy-save-btn` with a minimal, theme-aware button:

**CSS:**
```css
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
```

**Layout:** Centered below the stat block in a flex row:
```css
.claudian-dnd-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0 4px;
}
```

### 3.2 Unsaved State

Button shows save icon + "Copy & Save" text. On click:
1. Copy the code block markdown to clipboard (`\`\`\`monster\n[yaml]\n\`\`\``)
2. Save entity to vault via `saveEntityToVault()`
3. Transition button to saved state

### 3.3 Saved State (Issue 9)

After saving (or when entity already exists in registry on render):

- Button changes to copy icon + "Copy" text (same subtle style)
- Below the button, show a clickable file reference: italic small text with link icon + path (e.g., `Monsters/Fire Giant.md`)
- Clicking the file reference opens the file in Obsidian via `app.workspace.openLinkText()`

**Detection on render:** When `replaceDndCodeFences()` processes a code block, check `EntityRegistry.search(name, entityType)` for a match with `source: 'custom'`. If found, render in saved state with the entity's `filePath`.

### 3.4 Remove Old Styles

Delete the parchment-themed button CSS:
- `.claudian-dnd-copy-save-btn` and all related rules from `archivist-dnd.css`
- Replace with the new `.archivist-dnd-action-btn` styles

---

## Section 4: Selectable Stat Blocks in Obsidian Editor

### 4.1 Problem

In Obsidian's live preview (CM6 editor), code blocks rendered by `registerMarkdownCodeBlockProcessor` display as widgets. But selecting a widget and pressing Backspace/Delete doesn't cleanly remove the entire code block — users must enter source mode and manually delete all YAML lines.

### 4.2 Approach: CodeMirror Editor Extension

Register a CM6 `EditorView` plugin via Obsidian's `registerEditorExtension()` API that adds a keymap handling Backspace and Delete near widget boundaries.

**How it works:**

1. On Backspace/Delete keypress, check if the current selection is adjacent to or spans a code block widget
2. If so, identify the full range of the code block (from opening ` ```monster ` to closing ` ``` `, inclusive of surrounding newlines)
3. Replace that range with empty string, effectively deleting the entire block
4. Return `true` to consume the keypress

**Implementation uses:**
- `@codemirror/view` `keymap` extension
- `syntaxTree` from `@codemirror/language` to find code block node boundaries
- Obsidian's `registerEditorExtension()` to install the extension

**Scope:** Only targets code blocks with languages in `DND_LANGUAGES` set (`monster`, `spell`, `item`). Regular code blocks are unaffected.

### 4.3 Visual Selection Feedback

When a D&D code block widget is selected (cursor at widget boundary), add a subtle visual indicator:
- A `cm-dnd-block-selected` class applied via CM6 decoration
- CSS: `outline: 2px solid var(--claudian-brand); outline-offset: 2px; border-radius: 4px;`

This gives the user visual confirmation that the block is selected before they press delete.

---

## File Changes Summary

| File | Action | Issues |
|------|--------|--------|
| `src/inquiry/features/chat/ui/RichInput.ts` | **Create** | 1, 2, 5 |
| `src/inquiry/features/chat/tabs/Tab.ts` | Modify (replace textarea with RichInput, reorder keydown) | 1, 2, 5 |
| `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` | Modify (insert chip into contentEditable) | 1 |
| `src/inquiry/shared/mention/MentionDropdownController.ts` | Modify (insert chip into contentEditable) | 1 |
| `src/inquiry/features/chat/ui/InputToolbar.ts` | Modify (remove PermissionToggle) | 3 |
| `src/inquiry/features/chat/ui/NavigationSidebar.ts` | **Delete** | 7 |
| `src/inquiry/features/chat/controllers/NavigationController.ts` | Modify (remove sidebar refs, audit ESC) | 4, 7 |
| `src/inquiry/core/types/models.ts` | Modify (label changes) | 6 |
| `src/inquiry/core/agent/QueryOptionsBuilder.ts` | Modify (hardcode unleashed) | 3 |
| `src/inquiry/features/chat/rendering/DndEntityRenderer.ts` | Modify (new button style, saved state detection) | 8, 9 |
| `src/inquiry/features/chat/rendering/MessageRenderer.ts` | Modify (pass EntityRegistry to replaceDndCodeFences) | 9 |
| `src/editor/DndBlockDeleteExtension.ts` | **Create** | 10 |
| `src/inquiry/InquiryModule.ts` | Modify (register editor extension) | 10 |
| `src/inquiry/style/components/input.css` | Modify (contentEditable styles, send button) | 1, 5 |
| `src/inquiry/style/toolbar/permission-toggle.css` | **Delete** | 3 |
| `src/styles/archivist-layout-overrides.css` | Modify (inline chip styles, remove entity-chips) | 1 |
| `src/styles/archivist-dnd.css` | Modify (new action button styles) | 8, 9 |
