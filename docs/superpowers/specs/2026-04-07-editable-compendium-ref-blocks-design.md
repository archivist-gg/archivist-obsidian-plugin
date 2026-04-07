# Editable Compendium Reference Blocks

## Problem

Compendium references (`{{monster:goblin}}`) render as read-only stat blocks with no side buttons, no edit capability, no column toggle, and no delete. The edit infrastructure already exists in the edit renderers (they accept `compendiumContext` and handle save/save-as-new), but nothing wires compendium ref widgets to it.

## Solution

Extend `CompendiumRefWidget` (CM6 widget) to include the full side button stack and connect to existing edit renderers with `compendiumContext`. Approach A: Widget-Level Edit Mode -- all editing happens in-place within the widget DOM.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Edit location | In-place within widget | Consistent with code block edit mode |
| Rendering context | Live Preview only | Reading mode is view-only, matching code blocks |
| Code reuse | Maximum -- reuse edit renderers, side buttons, compendium manager | Existing code already supports `compendiumContext` |
| Save As New | No modal, auto-name from title, inline picker if 2+ compendiums | Streamlined UX |
| Cross-doc updates | CM6 StateEffect broadcast | Lightweight, no polling |
| Readonly entities (SRD) | Save hidden, only Save As New | Existing `isReadonly` flag in side buttons |

---

## 1. Widget Enhancement -- Side Buttons & View Mode

### Current State

`CompendiumRefWidget.toDOM()` produces a bare `div.archivist-compendium-ref` with just a badge and rendered block. No interactivity.

### New State

The widget DOM becomes:

```
div.archivist-compendium-ref
  div.archivist-compendium-badge  ("SRD")
  div (rendered stat block)
  div.archivist-side-btns
```

Side buttons rendered via existing `renderSideButtons()` with `state: "default"`:
- **Monster refs**: Column Toggle + Edit + Delete
- **Spell/Item refs**: Edit + Delete (`showColumnToggle: false`)

The widget needs access to `EditorView` (for dispatching transactions) and the `plugin` instance (for `compendiumManager`). These are passed via module-level refs, same pattern as the existing `registryRef`.

---

## 2. Edit Mode Lifecycle

### Enter Edit Mode

1. User clicks Edit button on the compendium ref widget
2. The rendered stat block is removed from the widget's DOM
3. The existing edit renderer is called with `compendiumContext: { slug, compendium, readonly }`:
   - `renderMonsterEditMode()` for monsters
   - `renderSpellEditMode()` for spells
   - `renderItemEditMode()` for items
4. Edit form output replaces the stat block inside the same widget container

### Edit Lock (Prevent Decoration Rebuild)

CM6 rebuilds decorations on doc changes, cursor moves, and viewport scrolls -- which would destroy the edit form. An edit lock prevents this:

- Module-level state: `editingRefRange: { from: number, to: number } | null`
- `buildCompendiumRefDecorations()` skips re-decorating the locked range while editing is active
- Range must be mapped through document changes (via `update.changes.mapPos()`) to stay valid if text is inserted/deleted elsewhere in the document while editing
- Extends the same cursor-awareness skip pattern that already exists for typing inside refs

### Exit Edit Mode

1. Clear the edit lock
2. Remove edit DOM from the widget container
3. Let the decoration system rebuild naturally
4. On save: registry is already updated, so rebuilt widget renders fresh data
5. On cancel: original data still in registry, rebuild restores original view

---

## 3. Save Flows

### Save (Update Existing Entity)

1. Edit renderer calls `compendiumManager.updateEntity(slug, data)` (existing)
2. Registry updated via `registry.register(updated)` (existing)
3. Call `refreshAllCompendiumRefs(plugin)` to re-render all open docs (Section 5)
4. Exit edit mode

Only available for writable compendium entities. Hidden for readonly (SRD) via existing `isReadonly` flag.

### Save As New

1. Get writable compendiums via `compendiumManager.getWritable()`
2. If 1 writable compendium: save directly
3. If 2+ writable compendiums: show inline dropdown anchored below Save As New button (new small component, parchment-themed)
4. Name auto-generated from entity's current title field (as edited by user)
5. Slug deduplication via existing `ensureUniqueSlug()` (e.g., `goblin`, `goblin-2`, `goblin-3`)
6. Call `compendiumManager.saveEntity(compendiumName, entityType, data)` (existing, returns `RegisteredEntity` with new slug)
7. Call `onReplaceRef(newRefText)` to update document: `{{monster:goblin}}` becomes `{{monster:goblin-custom}}`
8. Call `refreshAllCompendiumRefs(plugin)`
9. Exit edit mode

### Delete

Clicking the trash icon expands it into a delete sub-menu:

1. Trash icon becomes **X** (cancel) with a small **down arrow** indicating sub-options below
2. Two icons appear below the X in the side button column:
   - **file-x** (Lucide `file-x`): Remove reference from document only. Deletes the `{{type:slug}}` text. Entity stays in compendium.
   - **book-x** (Lucide `book-x`, red tint): Delete entity from compendium.
3. Other buttons (edit, column toggle) dim but remain clickable -- clicking them closes the delete menu
4. Clicking X closes the delete menu

**Delete from compendium flow:**
- Count all references to this entity across the vault (both `{{type:slug}}` and `[[slug]]` patterns)
- If other references exist: show confirmation -- "Delete [name] from [compendium]? This entity is referenced in X other locations. Those references will break."
- If confirmed: remove `{{type:slug}}` from current document, delete entity file from vault, unregister from registry
- All other references become broken (render as "entity not found" block)

---

## 4. Entity Not Found Block

When a `{{type:slug}}` reference points to a deleted or missing entity, render a styled inline alert instead of plain text:

**Style: Minimal inline (Option A)**
- Dashed border: `1px dashed #c9553a`
- Background: `rgba(201, 85, 58, 0.06)`
- Warning icon (Lucide `alert-triangle`) in `#c9553a`
- Text: "Entity not found" in `#922610` (bold), reference text below in `#7a200d` (dimmed)
- Compact single-line layout, max-width constrained

---

## 5. Cross-Document Re-rendering

When Save or Save As New completes, all open documents need to refresh their compendium ref widgets:

1. Define a CM6 `StateEffect<null>` (`compendiumRefreshEffect`) in `compendium-ref-extension.ts`
2. Export `refreshAllCompendiumRefs(plugin)`:
   - Iterates all open `MarkdownView` leaves via `plugin.app.workspace.iterateAllLeaves()`
   - Gets each leaf's `EditorView`
   - Dispatches a transaction with `compendiumRefreshEffect`
3. `compendiumRefPlugin.update()` checks for this effect -- if present, rebuilds decorations (pulls fresh data from registry)
4. Called after both `updateEntity()` and `saveEntity()`

---

## 6. Edit Renderer Refactoring

Minimal changes to support being called from both code blocks and compendium ref widgets:

### Parameter Changes

```ts
// Before
renderMonsterEditMode(monster, el, ctx, plugin, onCancelExit?, compendiumContext?)
renderSpellEditMode(spell, el, ctx, plugin, onCancelExit?, compendiumContext?)
renderItemEditMode(item, el, ctx, plugin, onCancelExit?, compendiumContext?)

// After
renderMonsterEditMode(monster, el, ctx?, plugin, onCancelExit?, compendiumContext?, onReplaceRef?)
renderSpellEditMode(spell, el, ctx?, plugin, onCancelExit?, compendiumContext?, onReplaceRef?)
renderItemEditMode(item, el, ctx?, plugin, onCancelExit?, compendiumContext?, onReplaceRef?)
```

### Changes

1. **`ctx` becomes optional** (`MarkdownPostProcessorContext | null | undefined`). Only used in code-block save path (`getSectionInfo` + `replaceRange`), unreachable when `compendiumContext` is provided.

2. **New `onReplaceRef` callback** (`(newRefText: string) => void`). Save As New calls this to update the document reference. The widget passes a callback that uses `EditorView.dispatch()` to replace the text.

3. **Save As New without modal (compendium ref path)**: When called from a widget (`onReplaceRef` is provided), auto-name from title, inline picker for 2+ compendiums. The `SaveAsNewModal` is still used for the code-block path (existing behavior unchanged).

### Zero Regression Risk

Existing code block callers in `main.ts` keep passing `ctx` as before. The new optional params are simply not passed. No existing call sites change.

---

## 7. Inline Compendium Picker

New small component for Save As New when 2+ writable compendiums exist:

- Small dropdown anchored below the Save As New button
- List of compendium names
- Parchment theme: `#fdf1dc` background, `#d9c484` border, matching side button styling
- Click a name: save to that compendium, dropdown closes
- Click outside: dropdown closes, no action
- If only 1 writable compendium: skip picker, save directly

This is the only net-new UI component in the feature.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/extensions/compendium-ref-extension.ts` | Add side buttons, edit mode, edit lock, refresh effect, plugin/view refs |
| `src/edit/monster-edit-render.ts` | Make `ctx` optional, add `onReplaceRef`, no-modal Save As New path |
| `src/edit/spell-edit-render.ts` | Same as monster |
| `src/edit/item-edit-render.ts` | Same as monster |
| `src/edit/side-buttons.ts` | Add expanding delete sub-menu (X + arrow + file-x + book-x) |
| `src/styles/archivist-dnd.css` | Styles for not-found block, inline compendium picker, delete sub-menu |

## New Components

| Component | Location |
|-----------|----------|
| Inline compendium picker | New function in `src/edit/` or within `compendium-ref-extension.ts` |
| Not-found styled block | Within `CompendiumRefWidget.toDOM()` and reading mode post-processor |

## Not In Scope

- Editing compendium refs in Reading mode (view-only, matching code blocks)
- Batch operations on compendium entities
- Undo/redo integration for compendium saves (vault file writes are not undoable via CM6)
