# Editable Compendium Reference Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make compendium reference widgets (`{{monster:goblin}}`) fully interactive — side buttons, in-place editing, save/save-as-new, delete, and cross-document refresh.

**Architecture:** CM6 widget (`CompendiumRefWidget`) gets side buttons and edit mode. An edit lock prevents decoration rebuilds during editing. Module-level refs expose `plugin` and `EditorView` to the widget. Edit renderers gain an optional `onReplaceRef` callback for the no-modal Save As New path. A `StateEffect` broadcast refreshes all open docs after save.

**Tech Stack:** CodeMirror 6, Obsidian API, TypeScript, js-yaml, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-07-editable-compendium-ref-blocks-design.md`

---

### Task 1: EntityRegistry.unregister()

**Files:**
- Modify: `src/entities/entity-registry.ts:25-60`
- Create: `tests/entity-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/entity-registry.test.ts
import { describe, it, expect } from "vitest";
import { EntityRegistry } from "../src/entities/entity-registry";

function makeEntity(slug: string, type = "monster", compendium = "SRD") {
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    entityType: type,
    filePath: `compendiums/${compendium}/${type}s/${slug}.md`,
    data: { name: slug },
    compendium,
    readonly: compendium === "SRD",
    homebrew: compendium !== "SRD",
  };
}

describe("EntityRegistry.unregister", () => {
  it("removes entity by slug", () => {
    const reg = new EntityRegistry();
    reg.register(makeEntity("goblin"));
    reg.register(makeEntity("orc"));

    reg.unregister("goblin");

    expect(reg.getBySlug("goblin")).toBeUndefined();
    expect(reg.getBySlug("orc")).toBeDefined();
    expect(reg.count()).toBe(1);
  });

  it("removes entity from type bucket", () => {
    const reg = new EntityRegistry();
    reg.register(makeEntity("goblin", "monster"));
    reg.register(makeEntity("fireball", "spell"));

    reg.unregister("goblin");

    expect(reg.getTypes()).toEqual(["spell"]);
  });

  it("is a no-op for unknown slug", () => {
    const reg = new EntityRegistry();
    reg.register(makeEntity("goblin"));

    reg.unregister("nonexistent");

    expect(reg.count()).toBe(1);
  });

  it("cleans up empty type bucket", () => {
    const reg = new EntityRegistry();
    reg.register(makeEntity("goblin", "monster"));

    reg.unregister("goblin");

    expect(reg.getTypes()).toEqual([]);
    expect(reg.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entity-registry.test.ts`
Expected: FAIL with "reg.unregister is not a function"

- [ ] **Step 3: Implement unregister()**

Add this method to `EntityRegistry` in `src/entities/entity-registry.ts` after the `register()` method (after line 60):

```ts
  /**
   * Remove an entity by slug. No-op if slug is not registered.
   */
  unregister(slug: string): void {
    const existing = this.bySlug.get(slug);
    if (!existing) return;

    this.bySlug.delete(slug);

    const bucket = this.byType.get(existing.entityType);
    if (bucket) {
      const idx = bucket.findIndex((e) => e.slug === slug);
      if (idx !== -1) bucket.splice(idx, 1);
      if (bucket.length === 0) this.byType.delete(existing.entityType);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entity-registry.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/entities/entity-registry.ts tests/entity-registry.test.ts
git commit -m "feat: add EntityRegistry.unregister() for entity deletion"
```

---

### Task 2: CompendiumManager.deleteEntity()

**Files:**
- Modify: `src/entities/compendium-manager.ts:336-368`

- [ ] **Step 1: Add deleteEntity() method**

Add after the `updateEntity()` method (after line 367) in `src/entities/compendium-manager.ts`:

```ts
  /**
   * Delete an entity file from its compendium and unregister it.
   */
  async deleteEntity(slug: string): Promise<void> {
    const existing = this.registry.getBySlug(slug);
    if (!existing) {
      throw new Error(`Entity not found: ${slug}`);
    }

    const file = this.vault.getAbstractFileByPath(existing.filePath);
    if (file) {
      await this.vault.delete(file);
    }

    this.registry.unregister(slug);
  }
```

- [ ] **Step 2: Add countReferences() method**

Add after `deleteEntity()` in `src/entities/compendium-manager.ts`. This counts how many `{{type:slug}}` references exist across the vault (excluding the current file):

```ts
  /**
   * Count how many files reference a given slug via {{type:slug}} or {{slug}} patterns.
   * Excludes the entity's own file and optionally a specific file path.
   */
  countReferences(slug: string, excludePath?: string): number {
    const patterns = [
      `{{${slug}}}`,
      `{{monster:${slug}}}`,
      `{{spell:${slug}}}`,
      `{{item:${slug}}}`,
    ];
    const entity = this.registry.getBySlug(slug);
    const entityPath = entity?.filePath;

    let count = 0;
    const files = this.vault.getMarkdownFiles();
    for (const file of files) {
      if (file.path === entityPath) continue;
      if (excludePath && file.path === excludePath) continue;
      const cache = (this.vault as any).app?.metadataCache?.getFileCache(file);
      // Fallback: we can't read file contents synchronously, so we count files
      // that contain the slug in their cached content. For accuracy, the caller
      // should use the async version below.
      count++; // placeholder — replaced by async version
    }
    return count;
  }
```

Actually, Obsidian's vault API doesn't support sync content reads. Replace with an async method:

```ts
  /**
   * Count files referencing a slug via {{type:slug}} or {{slug}} patterns.
   * Excludes the entity's own compendium file and an optional exclude path.
   */
  async countReferences(slug: string, excludePath?: string): Promise<number> {
    const entity = this.registry.getBySlug(slug);
    const entityFilePath = entity?.filePath;

    const refPatterns = [
      `{{${slug}}}`,
      `{{monster:${slug}}}`,
      `{{spell:${slug}}}`,
      `{{item:${slug}}}`,
    ];

    let count = 0;
    const files = this.vault.getMarkdownFiles();

    for (const file of files) {
      if (file.path === entityFilePath) continue;
      if (excludePath && file.path === excludePath) continue;

      const content = await this.vault.cachedRead(file);
      if (refPatterns.some((p) => content.includes(p))) {
        count++;
      }
    }

    return count;
  }
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests still pass (no tests for CompendiumManager, but no regressions)

- [ ] **Step 4: Commit**

```bash
git add src/entities/compendium-manager.ts
git commit -m "feat: add CompendiumManager.deleteEntity() and countReferences()"
```

---

### Task 3: Entity Not Found Block (Styled)

**Files:**
- Modify: `src/extensions/compendium-ref-extension.ts:104-109` (widget `notFoundEl`)
- Modify: `src/main.ts:461-464` (reading mode error)
- Modify: `src/styles/archivist-dnd.css:1798-1808` (styles)

- [ ] **Step 1: Add CSS for styled not-found block**

Replace the existing `.archivist-ref-error` block (lines 1798-1808) in `src/styles/archivist-dnd.css` with:

```css
/* Entity not found — styled inline alert */
.archivist-ref-error,
.archivist-compendium-ref-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 8px 0;
  background: rgba(201, 85, 58, 0.06);
  border: 1px dashed #c9553a;
  border-radius: 4px;
  max-width: 400px;
}

.archivist-ref-error .archivist-not-found-icon,
.archivist-compendium-ref-error .archivist-not-found-icon {
  flex-shrink: 0;
  color: #c9553a;
}

.archivist-ref-error .archivist-not-found-text,
.archivist-compendium-ref-error .archivist-not-found-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.archivist-not-found-label {
  font-weight: 600;
  font-size: 13px;
  color: #922610;
}

.archivist-not-found-ref {
  font-size: 12px;
  color: #7a200d;
  opacity: 0.7;
  font-family: var(--font-monospace);
}
```

- [ ] **Step 2: Update widget notFoundEl() in compendium-ref-extension.ts**

Replace the `notFoundEl` method (lines 104-109) in `src/extensions/compendium-ref-extension.ts`:

```ts
  private notFoundEl(ref: CompendiumRef): HTMLElement {
    const el = document.createElement("div");
    el.className = "archivist-compendium-ref-error";

    const icon = el.createDiv({ cls: "archivist-not-found-icon" });
    setIcon(icon, "alert-triangle");

    const textWrap = el.createDiv({ cls: "archivist-not-found-text" });
    textWrap.createDiv({ cls: "archivist-not-found-label", text: "Entity not found" });
    textWrap.createDiv({
      cls: "archivist-not-found-ref",
      text: ref.entityType ? `${ref.entityType}:${ref.slug}` : ref.slug,
    });

    return el;
  }
```

Add `setIcon` to the imports at the top of `src/extensions/compendium-ref-extension.ts` (line 1):

```ts
import { setIcon } from "obsidian";
```

Note: `createDiv` is available on `HTMLElement` via Obsidian's prototype extensions, but since this runs in a CM6 widget (pure DOM context), use `document.createElement` instead:

```ts
  private notFoundEl(ref: CompendiumRef): HTMLElement {
    const el = document.createElement("div");
    el.className = "archivist-compendium-ref-error";

    const icon = document.createElement("div");
    icon.className = "archivist-not-found-icon";
    setIcon(icon, "alert-triangle");
    el.appendChild(icon);

    const textWrap = document.createElement("div");
    textWrap.className = "archivist-not-found-text";

    const label = document.createElement("div");
    label.className = "archivist-not-found-label";
    label.textContent = "Entity not found";
    textWrap.appendChild(label);

    const refText = document.createElement("div");
    refText.className = "archivist-not-found-ref";
    refText.textContent = ref.entityType ? `${ref.entityType}:${ref.slug}` : ref.slug;
    textWrap.appendChild(refText);

    el.appendChild(textWrap);
    return el;
  }
```

- [ ] **Step 3: Update reading mode error in main.ts**

Replace the reading mode error block (lines 461-464) in `src/main.ts`:

```ts
            } else {
              const errEl = document.createElement("div");
              errEl.classList.add("archivist-ref-error");

              const icon = errEl.createDiv({ cls: "archivist-not-found-icon" });
              setIcon(icon, "alert-triangle");

              const textWrap = errEl.createDiv({ cls: "archivist-not-found-text" });
              textWrap.createDiv({ cls: "archivist-not-found-label", text: "Entity not found" });
              textWrap.createDiv({
                cls: "archivist-not-found-ref",
                text: match[0].replace(/[{}]/g, ""),
              });

              frag.appendChild(errEl);
            }
```

Ensure `setIcon` is already imported in `main.ts` (it should be — check the existing imports).

- [ ] **Step 4: Build and verify**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/`

Verify in Obsidian: type `{{monster:nonexistent}}` and confirm styled not-found block appears with alert-triangle icon, "Entity not found" label, and dimmed reference text.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/compendium-ref-extension.ts src/main.ts src/styles/archivist-dnd.css
git commit -m "feat: styled entity-not-found block with alert icon"
```

---

### Task 4: Cross-Document Re-rendering

**Files:**
- Modify: `src/extensions/compendium-ref-extension.ts:1-10,149-166`

- [ ] **Step 1: Add StateEffect and export refresh function**

Add these imports to the top of `src/extensions/compendium-ref-extension.ts` (merge into existing import from `@codemirror/state`):

```ts
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
```

Add after the `setCompendiumRefRegistry` function (after line 27), before the re-export line:

```ts
// ---------------------------------------------------------------------------
// Cross-document refresh
// ---------------------------------------------------------------------------

/** Dispatch this effect to force compendium ref decorations to rebuild. */
export const compendiumRefreshEffect = StateEffect.define<null>();

/**
 * Refresh compendium ref widgets in all open editor views.
 * Call after updateEntity() or saveEntity() to propagate changes.
 */
export function refreshAllCompendiumRefs(plugin: any): void {
  plugin.app.workspace.iterateAllLeaves((leaf: any) => {
    if (leaf.view?.getViewType?.() === "markdown") {
      const editorView = (leaf.view as any).editor?.cm as EditorView | undefined;
      if (editorView) {
        editorView.dispatch({ effects: compendiumRefreshEffect.of(null) });
      }
    }
  });
}
```

- [ ] **Step 2: Update ViewPlugin to respond to refresh effect**

Replace the `update()` method in the `compendiumRefPlugin` (lines 157-159) in `src/extensions/compendium-ref-extension.ts`:

```ts
    update(update: ViewUpdate) {
      const hasRefresh = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(compendiumRefreshEffect)),
      );
      if (hasRefresh || update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildCompendiumRefDecorations(update.view);
      }
    }
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/extensions/compendium-ref-extension.ts
git commit -m "feat: add cross-document refresh via StateEffect broadcast"
```

---

### Task 5: Inline Compendium Picker

**Files:**
- Create: `src/edit/compendium-picker.ts`
- Modify: `src/styles/archivist-dnd.css`

> **Dependency note:** This task must complete before Task 6 (edit renderer refactoring imports `showCompendiumPicker`).

- [ ] **Step 1: Create compendium-picker.ts**

```ts
// src/edit/compendium-picker.ts

/**
 * Inline dropdown for choosing which compendium to save to.
 * Anchored below a trigger element (e.g., the Save As New button).
 * Parchment-themed, auto-closes on outside click.
 */
export function showCompendiumPicker(
  anchor: HTMLElement,
  compendiums: { name: string }[],
  onSelect: (compendium: { name: string }) => void,
): void {
  // Remove any existing picker
  anchor.querySelector(".archivist-compendium-picker")?.remove();

  const picker = document.createElement("div");
  picker.className = "archivist-compendium-picker";

  for (const comp of compendiums) {
    const option = document.createElement("div");
    option.className = "archivist-compendium-picker-option";
    option.textContent = comp.name;
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      cleanup();
      onSelect(comp);
    });
    picker.appendChild(option);
  }

  anchor.appendChild(picker);

  // Close on outside click (next tick to avoid immediate close)
  const onOutsideClick = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      cleanup();
    }
  };

  function cleanup() {
    picker.remove();
    document.removeEventListener("click", onOutsideClick, true);
  }

  setTimeout(() => {
    document.addEventListener("click", onOutsideClick, true);
  }, 0);
}
```

- [ ] **Step 2: Add CSS for the picker**

Add to `src/styles/archivist-dnd.css` after the `.archivist-plus-overlay` block (after line 1830):

```css
/* Inline compendium picker dropdown */
.archivist-compendium-picker {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  min-width: 140px;
  background: #fdf1dc;
  border: 1px solid #d9c484;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.archivist-compendium-picker-option {
  padding: 6px 12px;
  font-size: 12px;
  color: #7a200d;
  cursor: pointer;
  white-space: nowrap;
}

.archivist-compendium-picker-option:hover {
  background: rgba(146, 38, 16, 0.1);
}
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/edit/compendium-picker.ts src/styles/archivist-dnd.css
git commit -m "feat: add inline compendium picker dropdown component"
```

---

### Task 6: Edit Renderer Refactoring

**Files:**
- Modify: `src/edit/monster-edit-render.ts:68-75,109-150,643-658`
- Modify: `src/edit/spell-edit-render.ts:27-34,76-113,293-331`
- Modify: `src/edit/item-edit-render.ts:27-34,76-113,314-352`

All three renderers get the same changes: `ctx` becomes optional, new `onReplaceRef` parameter, no-modal Save As New path when `onReplaceRef` is provided.

- [ ] **Step 1: Refactor monster-edit-render.ts signature**

In `src/edit/monster-edit-render.ts`, change the signature (line 68-75):

```ts
export function renderMonsterEditMode(
  monster: Monster,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext | null | undefined,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
  onReplaceRef?: (newRefText: string) => void,
): void {
```

- [ ] **Step 2: Update monster Save As New to support no-modal path**

Replace the `onSaveAsNew` handler (lines 123-150) in `src/edit/monster-edit-render.ts`:

```ts
      onSaveAsNew: () => {
        const writable = plugin.compendiumManager?.getWritable() ?? [];
        if (writable.length === 0) {
          new Notice("No writable compendiums found. Create one first.");
          return;
        }
        const yamlStr = state.toYaml();
        const yamlData = yaml.load(yamlStr) as Record<string, unknown>;

        if (onReplaceRef) {
          // Widget path: no modal, auto-name from current title
          const saveTo = (comp: { name: string }) => {
            plugin.compendiumManager!.saveEntity(comp.name, "monster", yamlData)
              .then((registered) => {
                onReplaceRef(`{{monster:${registered.slug}}}`);
                new Notice(`Saved as new to ${comp.name}`);
                if (onCancelExit) onCancelExit();
              })
              .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
          };

          if (writable.length === 1) {
            saveTo(writable[0]);
          } else {
            // Show inline picker — import at top of file
            showCompendiumPicker(sideBtns!, writable, saveTo);
          }
        } else {
          // Code block path: use modal (existing behavior)
          new SaveAsNewModal(plugin.app, writable, state.current.name, (comp, name) => {
            yamlData.name = name;
            plugin.compendiumManager!.saveEntity(comp.name, "monster", yamlData)
              .then((registered) => {
                const info = ctx?.getSectionInfo(el);
                if (info) {
                  const editor = plugin.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: info.lineStart, ch: 0 };
                    const to = { line: info.lineEnd, ch: editor.getLine(info.lineEnd).length };
                    editor.replaceRange(`{{monster:${registered.slug}}}`, from, to);
                  }
                }
                new Notice(`Saved as new to ${comp.name}`);
                if (onCancelExit) onCancelExit();
              })
              .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
          }).open();
        }
      },
```

Add import at top of `src/edit/monster-edit-render.ts`:

```ts
import { showCompendiumPicker } from "./compendium-picker";
```

- [ ] **Step 3: Guard ctx usage in monster saveAndExit()**

In `src/edit/monster-edit-render.ts`, the `saveAndExit()` function (lines 643-658) uses `ctx.getSectionInfo(el)`. Add a guard:

```ts
  function saveAndExit() {
    const yamlStr = state.toYaml();
    if (!ctx) { cancelAndExit(); return; }
    const info = ctx.getSectionInfo(el);
    if (!info) { cancelAndExit(); return; }
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (!editor) { cancelAndExit(); return; }

    const fromLine = info.lineStart;
    const toLine = info.lineEnd;
    const endCh = editor.getLine(toLine).length;
    const newContent = "```monster\n" + yamlStr + "```";
    editor.replaceRange(newContent, { line: fromLine, ch: 0 }, { line: toLine, ch: endCh });
    editor.setCursor({ line: fromLine, ch: 0 });
    if (onCancelExit) onCancelExit();
  }
```

- [ ] **Step 4: Apply same changes to spell-edit-render.ts**

In `src/edit/spell-edit-render.ts`, change the signature (lines 27-34):

```ts
export function renderSpellEditMode(
  spell: Spell,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext | null | undefined,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
  onReplaceRef?: (newRefText: string) => void,
): void {
```

Add import:
```ts
import { showCompendiumPicker } from "./compendium-picker";
```

Replace the `onSaveAsNew` handler (lines 89-113) with the same pattern as monster but using `"spell"` as entity type, `draft.name` instead of `state.current.name`, and `buildClean()` instead of `state.toYaml()`:

```ts
      onSaveAsNew: () => {
        const writable = plugin.compendiumManager?.getWritable() ?? [];
        if (writable.length === 0) {
          new Notice("No writable compendiums found. Create one first.");
          return;
        }
        const yamlData = buildClean();

        if (onReplaceRef) {
          const saveTo = (comp: { name: string }) => {
            plugin.compendiumManager!.saveEntity(comp.name, "spell", yamlData)
              .then((registered) => {
                onReplaceRef(`{{spell:${registered.slug}}}`);
                new Notice(`Saved as new to ${comp.name}`);
                if (onCancelExit) onCancelExit();
              })
              .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
          };

          if (writable.length === 1) {
            saveTo(writable[0]);
          } else {
            showCompendiumPicker(sideBtns!, writable, saveTo);
          }
        } else {
          new SaveAsNewModal(plugin.app, writable, draft.name, (comp, name) => {
            yamlData.name = name;
            plugin.compendiumManager!.saveEntity(comp.name, "spell", yamlData)
              .then((registered) => {
                const info = ctx?.getSectionInfo(el);
                if (info) {
                  const editor = plugin.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: info.lineStart, ch: 0 };
                    const to = { line: info.lineEnd, ch: editor.getLine(info.lineEnd).length };
                    editor.replaceRange(`{{spell:${registered.slug}}}`, from, to);
                  }
                }
                new Notice(`Saved as new to ${comp.name}`);
                if (onCancelExit) onCancelExit();
              })
              .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
          }).open();
        }
      },
```

Guard `ctx` in spell `saveAndExit()` (line 293 area) — add `if (!ctx) { cancelAndExit(); return; }` at the start.

- [ ] **Step 5: Apply same changes to item-edit-render.ts**

Same pattern as spell. In `src/edit/item-edit-render.ts`:

Change signature (lines 27-34):
```ts
export function renderItemEditMode(
  item: Item,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext | null | undefined,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
  onReplaceRef?: (newRefText: string) => void,
): void {
```

Add import:
```ts
import { showCompendiumPicker } from "./compendium-picker";
```

Replace `onSaveAsNew` (lines 89-113) — same pattern, entity type `"item"`, use `buildClean()` and `draft.name`.

Guard `ctx` in item `saveAndExit()` — add `if (!ctx) { cancelAndExit(); return; }`.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing call sites in `main.ts` still pass `ctx` as before)

- [ ] **Step 7: Commit**

```bash
git add src/edit/monster-edit-render.ts src/edit/spell-edit-render.ts src/edit/item-edit-render.ts
git commit -m "refactor: make ctx optional in edit renderers, add onReplaceRef for widget path"
```

---

### Task 7: Side Buttons — Expanding Delete Sub-menu

**Files:**
- Modify: `src/edit/side-buttons.ts:3-17,63-88`
- Modify: `src/styles/archivist-dnd.css`

- [ ] **Step 1: Extend SideButtonConfig with delete sub-menu callbacks**

In `src/edit/side-buttons.ts`, update the interface (lines 5-17):

```ts
interface SideButtonConfig {
  state: SideButtonState;
  onEdit: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onCompendium: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDeleteRef?: () => void;
  onDeleteEntity?: () => void;
  onColumnToggle: () => void;
  isColumnActive: boolean;
  showColumnToggle?: boolean;
  isReadonly?: boolean;
}
```

- [ ] **Step 2: Implement expanding delete sub-menu**

Replace the delete button section (lines 82-87) in the `else` block (default/editing state) of `renderSideButtons()`:

```ts
    // Delete — LAST — expands into sub-menu
    const deleteBtn = container.createDiv({ cls: "archivist-side-btn" });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.setAttribute("aria-label", "Delete");

    if (config.onDeleteRef || config.onDeleteEntity) {
      // Expandable delete sub-menu
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = container.hasClass("archivist-delete-menu-open");
        if (isOpen) {
          container.removeClass("archivist-delete-menu-open");
          container.querySelectorAll(".archivist-delete-sub-btn").forEach((el) => el.remove());
          setIcon(deleteBtn, "trash-2");
          return;
        }

        // Switch trash to X (close)
        container.addClass("archivist-delete-menu-open");
        setIcon(deleteBtn, "x");

        // Add sub-buttons after the delete button
        if (config.onDeleteRef) {
          const refBtn = container.createDiv({ cls: "archivist-side-btn archivist-delete-sub-btn" });
          setIcon(refBtn, "file-x");
          refBtn.setAttribute("aria-label", "Remove reference from document");
          refBtn.title = "Remove reference";
          refBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            config.onDeleteRef!();
          });
        }

        if (config.onDeleteEntity) {
          const entityBtn = container.createDiv({
            cls: "archivist-side-btn archivist-delete-sub-btn archivist-delete-entity-btn",
          });
          setIcon(entityBtn, "book-x");
          entityBtn.setAttribute("aria-label", "Delete entity from compendium");
          entityBtn.title = "Delete from compendium";
          entityBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            config.onDeleteEntity!();
          });
        }
      });
    } else {
      // Simple delete (code block path — existing behavior)
      deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onDelete(); });
    }
```

- [ ] **Step 3: Close delete menu when other buttons are clicked**

Wrap each non-delete button click handler in the default/editing state to also close the delete menu. Add a helper at the top of the function body:

```ts
  const closeDeleteMenu = () => {
    container.removeClass("archivist-delete-menu-open");
    container.querySelectorAll(".archivist-delete-sub-btn").forEach((el) => el.remove());
    const trashBtn = container.querySelector(".archivist-side-btn:last-child");
    if (trashBtn && container.querySelector(".archivist-delete-menu-open") === null) {
      // Re-icon handled by re-render
    }
  };
```

Actually, simpler approach: when any non-delete button is clicked, just call `renderSideButtons()` again which rebuilds everything. The existing buttons already call their handlers which trigger re-renders. No extra code needed — clicking Edit triggers `onEdit` which already causes a full re-render to "editing" state.

- [ ] **Step 4: Add CSS for delete sub-menu**

Add to `src/styles/archivist-dnd.css`:

```css
/* Delete sub-menu */
.archivist-delete-menu-open .archivist-side-btn:not(.archivist-delete-sub-btn) {
  opacity: 0.4;
}

.archivist-delete-menu-open .archivist-side-btn:last-of-type:not(.archivist-delete-sub-btn) {
  opacity: 1;
}

.archivist-delete-sub-btn {
  animation: archivist-fade-in 0.15s ease;
}

.archivist-delete-entity-btn {
  color: #c9553a;
}

@keyframes archivist-fade-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/edit/side-buttons.ts src/styles/archivist-dnd.css
git commit -m "feat: expanding delete sub-menu with file-x and book-x options"
```

---

### Task 8: Widget — Module-level Refs and Side Buttons

**Files:**
- Modify: `src/extensions/compendium-ref-extension.ts:19-27,37-110`
- Modify: `src/main.ts:70,573`

- [ ] **Step 1: Add module-level plugin and view refs**

In `src/extensions/compendium-ref-extension.ts`, after the `registryRef` section (after line 27), add:

```ts
// Module-level plugin reference (set by main.ts at plugin load)
let pluginRef: any = null;

export function setCompendiumRefPlugin(plugin: any): void {
  pluginRef = plugin;
}
```

- [ ] **Step 2: Set plugin ref in main.ts**

In `src/main.ts`, import `setCompendiumRefPlugin`:

```ts
import {
  compendiumRefPlugin,
  setCompendiumRefRegistry,
  setCompendiumRefPlugin,
  parseCompendiumRef,
} from "./extensions/compendium-ref-extension";
```

After `setCompendiumRefRegistry(this.entityRegistry)` (line 70 of `main.ts`), add:

```ts
setCompendiumRefPlugin(this);
```

- [ ] **Step 3: Refactor CompendiumRefWidget to accept view**

The widget's `toDOM()` method receives no arguments by CM6 design. But `toDOM(view: EditorView)` is actually called with the view as the first argument. Update the widget to capture and use it.

In `src/extensions/compendium-ref-extension.ts`, update the `CompendiumRefWidget` class:

```ts
class CompendiumRefWidget extends WidgetType {
  constructor(private refText: string) {
    super();
  }

  eq(other: CompendiumRefWidget): boolean {
    return this.refText === other.refText;
  }

  toDOM(view: EditorView): HTMLElement {
    const ref = parseCompendiumRef(this.refText);

    if (!ref || !registryRef) {
      const err = document.createElement("code");
      err.className = "archivist-compendium-ref-error";
      err.textContent = this.refText;
      return err;
    }

    const entity = registryRef.getBySlug(ref.slug);

    if (entity && ref.entityType && entity.entityType !== ref.entityType) {
      return this.notFoundEl(ref);
    }

    if (!entity) {
      return this.notFoundEl(ref);
    }

    const rendered = this.renderEntityBlock(entity);
    if (!rendered) {
      const err = document.createElement("div");
      err.className = "archivist-compendium-ref-error";
      err.textContent = `Cannot render ${entity.entityType}: ${ref.slug}`;
      return err;
    }

    // Badge
    const badge = document.createElement("div");
    badge.className = "archivist-compendium-badge";
    badge.textContent = entity.compendium;

    // Container
    const container = document.createElement("div");
    container.className = "archivist-compendium-ref";
    container.appendChild(badge);
    container.appendChild(rendered);

    // Side buttons
    const sideBtns = document.createElement("div");
    sideBtns.className = "archivist-side-btns";
    container.appendChild(sideBtns);

    this.renderViewSideButtons(sideBtns, entity, ref, view, container);

    return container;
  }

  /** Render entity data into a stat block element. */
  private renderEntityBlock(entity: { entityType: string; data: Record<string, unknown> }): HTMLElement | null {
    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
    const type = entity.entityType;

    if (type === "monster") {
      const result = parseMonster(yamlStr);
      if (result.success) return renderMonsterBlock(result.data);
    } else if (type === "spell") {
      const result = parseSpell(yamlStr);
      if (result.success) return renderSpellBlock(result.data);
    } else if (type === "item" || type === "magic-item") {
      const result = parseItem(yamlStr);
      if (result.success) return renderItemBlock(result.data);
    }
    return null;
  }

  /** Render side buttons for view mode (default state). */
  private renderViewSideButtons(
    sideBtns: HTMLElement,
    entity: RegisteredEntity,
    ref: CompendiumRef,
    view: EditorView,
    container: HTMLElement,
  ): void {
    const isMonster = entity.entityType === "monster";
    let columns = 1;

    renderSideButtons(sideBtns, {
      state: "default",
      isColumnActive: columns === 2,
      showColumnToggle: isMonster,
      onEdit: () => {
        this.enterEditMode(container, sideBtns, entity, ref, view);
      },
      onSave: () => {},
      onSaveAsNew: () => {},
      onCompendium: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onDeleteRef: () => {
        // Remove {{type:slug}} from document
        this.deleteRefFromDocument(view, container);
      },
      onDeleteEntity: () => {
        // Delete entity from compendium
        this.deleteEntityFromCompendium(entity, view, container);
      },
      onColumnToggle: () => {
        if (!isMonster) return;
        columns = columns === 1 ? 2 : 1;
        const renderedBlock = container.querySelector(".archivist-monster-block");
        if (renderedBlock) {
          const newBlock = this.renderEntityBlock({ ...entity, data: { ...entity.data, columns } });
          if (newBlock) renderedBlock.replaceWith(newBlock);
        }
        this.renderViewSideButtons(sideBtns, entity, ref, view, container);
      },
    });
  }
```

- [ ] **Step 4: Add import for renderSideButtons and RegisteredEntity**

Add to the imports at top of `src/extensions/compendium-ref-extension.ts`:

```ts
import { renderSideButtons } from "../edit/side-buttons";
import type { RegisteredEntity } from "../entities/entity-registry";
```

- [ ] **Step 5: Add stub methods for edit and delete (implemented in Task 10)**

Add these stub methods to the `CompendiumRefWidget` class (will be filled in Task 10):

```ts
  /** Get the current document range of this widget's {{...}} text. */
  private getRange(container: HTMLElement, view: EditorView): { from: number; to: number } {
    const from = view.posAtDOM(container);
    return { from, to: from + this.refText.length };
  }

  /** Enter edit mode — implemented in Task 10. */
  private enterEditMode(
    container: HTMLElement,
    sideBtns: HTMLElement,
    entity: RegisteredEntity,
    ref: CompendiumRef,
    view: EditorView,
  ): void {
    // TODO: Task 10
  }

  /** Remove the {{type:slug}} text from the document. */
  private deleteRefFromDocument(view: EditorView, container: HTMLElement): void {
    // TODO: Task 10
  }

  /** Delete entity from compendium with confirmation. */
  private deleteEntityFromCompendium(
    entity: RegisteredEntity,
    view: EditorView,
    container: HTMLElement,
  ): void {
    // TODO: Task 10
  }
```

- [ ] **Step 6: Build to check for compile errors**

Run: `npm run build`
Expected: Compiles successfully (stubs have no logic but are type-correct)

- [ ] **Step 7: Commit**

```bash
git add src/extensions/compendium-ref-extension.ts src/main.ts
git commit -m "feat: add side buttons to compendium ref widget (stubs for edit/delete)"
```

---

### Task 9: Edit Lock Mechanism

**Files:**
- Modify: `src/extensions/compendium-ref-extension.ts`

- [ ] **Step 1: Add edit lock state**

In `src/extensions/compendium-ref-extension.ts`, after the `pluginRef` section, add:

```ts
// ---------------------------------------------------------------------------
// Edit lock — prevents decoration rebuild while editing a compendium ref
// ---------------------------------------------------------------------------

let editingRefRange: { from: number; to: number } | null = null;

export function setEditingRefRange(range: { from: number; to: number } | null): void {
  editingRefRange = range;
}

export function getEditingRefRange(): { from: number; to: number } | null {
  return editingRefRange;
}
```

- [ ] **Step 2: Skip locked range in buildCompendiumRefDecorations()**

In `buildCompendiumRefDecorations()`, add a skip check after the cursor skip (after line 132):

```ts
      // Skip decoration when the cursor is strictly inside the reference (user is typing)
      if (cursorPos > start && cursorPos < end) continue;

      // Skip decoration when this range is locked for editing
      if (editingRefRange && start === editingRefRange.from && end === editingRefRange.to) continue;
```

- [ ] **Step 3: Map edit lock range through document changes**

In the `compendiumRefPlugin`'s `update()` method, add range mapping before rebuilding decorations:

```ts
    update(update: ViewUpdate) {
      // Map editing lock range through document changes
      if (editingRefRange && update.docChanged) {
        try {
          editingRefRange = {
            from: update.changes.mapPos(editingRefRange.from),
            to: update.changes.mapPos(editingRefRange.to),
          };
        } catch {
          // Position no longer valid — clear the lock
          editingRefRange = null;
        }
      }

      const hasRefresh = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(compendiumRefreshEffect)),
      );
      if (hasRefresh || update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildCompendiumRefDecorations(update.view);
      }
    }
```

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/extensions/compendium-ref-extension.ts
git commit -m "feat: edit lock mechanism to prevent decoration rebuild during editing"
```

---

### Task 10: Edit Mode Lifecycle — Enter, Exit, Save, Delete

**Files:**
- Modify: `src/extensions/compendium-ref-extension.ts` (widget methods)

This is the final wiring task. The widget's stub methods from Task 8 get their implementations.

- [ ] **Step 1: Add edit renderer imports**

Add to the imports in `src/extensions/compendium-ref-extension.ts`:

```ts
import { renderMonsterEditMode } from "../edit/monster-edit-render";
import { renderSpellEditMode } from "../edit/spell-edit-render";
import { renderItemEditMode } from "../edit/item-edit-render";
import { Notice } from "obsidian";
```

- [ ] **Step 2: Add getRange() helper to the widget class**

CM6 widgets may be reused across decoration rebuilds (when `eq()` returns true), which means constructor-time positions go stale. Instead, compute the range at click time using `view.posAtDOM()`:

```ts
  /** Get the current document range of this widget's {{...}} text. */
  private getRange(container: HTMLElement, view: EditorView): { from: number; to: number } {
    const from = view.posAtDOM(container);
    return { from, to: from + this.refText.length };
  }
```

Add this method to the `CompendiumRefWidget` class. No constructor changes needed.

- [ ] **Step 3: Implement enterEditMode()**

Replace the stub `enterEditMode()`:

```ts
  private enterEditMode(
    container: HTMLElement,
    sideBtns: HTMLElement,
    entity: RegisteredEntity,
    ref: CompendiumRef,
    view: EditorView,
  ): void {
    // Compute current range and set edit lock
    const range = this.getRange(container, view);
    setEditingRefRange(range);

    // Remove rendered stat block (keep side buttons and container)
    const badge = container.querySelector(".archivist-compendium-badge");
    const statBlock = container.querySelector(
      ".archivist-monster-block, .archivist-spell-block, .archivist-item-block",
    );
    badge?.remove();
    statBlock?.remove();

    sideBtns.classList.add("always-visible");

    const compendiumContext = {
      slug: entity.slug,
      compendium: entity.compendium,
      readonly: entity.readonly,
    };

    const onCancelExit = () => {
      // Clear edit lock
      setEditingRefRange(null);
      // Dispatch refresh to rebuild all widgets
      refreshAllCompendiumRefs(pluginRef);
    };

    const onReplaceRef = (newRefText: string) => {
      // Replace the {{type:slug}} text in the document via CM6 transaction
      // Use the mapped edit lock range (stays current through doc changes)
      const currentRange = getEditingRefRange();
      if (currentRange) {
        view.dispatch({
          changes: { from: currentRange.from, to: currentRange.to, insert: newRefText },
        });
      }
    };

    const type = entity.entityType;
    if (type === "monster") {
      const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
      const result = parseMonster(yamlStr);
      if (result.success) {
        renderMonsterEditMode(
          result.data, container, null, pluginRef,
          onCancelExit, compendiumContext, onReplaceRef,
        );
      }
    } else if (type === "spell") {
      const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
      const result = parseSpell(yamlStr);
      if (result.success) {
        renderSpellEditMode(
          result.data, container, null, pluginRef,
          onCancelExit, compendiumContext, onReplaceRef,
        );
      }
    } else if (type === "item" || type === "magic-item") {
      const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
      const result = parseItem(yamlStr);
      if (result.success) {
        renderItemEditMode(
          result.data, container, null, pluginRef,
          onCancelExit, compendiumContext, onReplaceRef,
        );
      }
    }
  }
```

- [ ] **Step 4: Implement deleteRefFromDocument()**

```ts
  private deleteRefFromDocument(view: EditorView, container: HTMLElement): void {
    const { from, to } = this.getRange(container, view);
    view.dispatch({
      changes: { from, to, insert: "" },
    });
  }
```

- [ ] **Step 5: Implement deleteEntityFromCompendium()**

```ts
  private deleteEntityFromCompendium(
    entity: RegisteredEntity,
    view: EditorView,
    container: HTMLElement,
  ): void {
    if (!pluginRef?.compendiumManager) return;

    const manager = pluginRef.compendiumManager;

    manager.countReferences(entity.slug).then((refCount: number) => {
      let message = `Delete "${entity.name}" from ${entity.compendium}?`;
      if (refCount > 0) {
        message += `\n\nThis entity is referenced in ${refCount} other location${refCount === 1 ? "" : "s"}. Those references will break.`;
      }

      if (confirm(message)) {
        // Remove ref from current document
        const { from, to } = this.getRange(container, view);
        view.dispatch({
          changes: { from, to, insert: "" },
        });

        // Delete entity from compendium
        manager.deleteEntity(entity.slug)
          .then(() => {
            new Notice(`Deleted ${entity.name} from ${entity.compendium}`);
            refreshAllCompendiumRefs(pluginRef);
          })
          .catch((e: Error) => new Notice(`Failed to delete: ${e.message}`));
      }
    });
  }
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Compiles successfully

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/extensions/compendium-ref-extension.ts
git commit -m "feat: wire edit mode lifecycle, save flows, and delete in compendium ref widget"
```

---

### Task 11: Build, Deploy, and Manual Verification

**Files:** None (testing only)

- [ ] **Step 1: Full build**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/`

- [ ] **Step 2: Manual test checklist**

In Obsidian, verify each feature:

1. **Not-found block**: Type `{{monster:nonexistent}}` — should show styled alert with icon
2. **Side buttons appear**: Type `{{monster:goblin}}` (with SRD loaded) — widget should show Column Toggle, Edit, Delete buttons on hover
3. **Column toggle**: Click column toggle on monster ref — toggles between 1 and 2 columns
4. **Edit mode entry**: Click Edit — stat block replaced by edit form, side buttons show Save As New + Cancel (Save hidden for SRD/readonly)
5. **Cancel**: Click Cancel — edit form removed, original stat block restored
6. **Save As New**: Click Save As New — if 1 writable compendium, saves directly; if 2+, shows inline picker
7. **Delete ref**: Click trash -> file-x — removes `{{monster:goblin}}` text from document
8. **Delete entity**: Click trash -> book-x — shows confirmation, deletes entity file, removes ref
9. **Cross-doc refresh**: Open entity in two docs, edit in one, save — both update
10. **Code block regression**: Existing ```` ```monster ```` blocks still work normally (edit, save, delete, compendium)

- [ ] **Step 3: Fix any issues found**

Address any bugs discovered during manual testing.

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```
