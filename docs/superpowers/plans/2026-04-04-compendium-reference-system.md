# Compendium Reference System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compendium system where entities are stored as rendered stat blocks in vault files, referenced via `{{type:slug}}` syntax with autocomplete, and editable with save-back-to-compendium or save-as-new flows.

**Architecture:** A new `CompendiumManager` handles folder discovery, metadata files, and entity CRUD. The existing `EntityRegistry` gains compendium-aware fields. A CM6 ViewPlugin + post-processor renders `{{}}` references as live stat blocks. Edit mode side buttons wire into save/save-as-new flows via an Obsidian modal for compendium selection.

**Tech Stack:** TypeScript, Obsidian API (EditorSuggest, Modal, PluginSettingTab), CodeMirror 6 (ViewPlugin, WidgetType, Decoration), js-yaml, Vitest

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/entities/compendium-manager.ts` | Compendium discovery, metadata parsing, entity save/update, CRUD |
| `src/extensions/compendium-suggest.ts` | `{{` autocomplete EditorSuggest (replaces entity-editor-suggest.ts) |
| `src/extensions/compendium-ref-extension.ts` | CM6 ViewPlugin for `{{}}` Live Preview rendering |
| `src/entities/compendium-modal.ts` | Obsidian Modal for compendium selection + entity naming |
| `tests/compendium-manager.test.ts` | Tests for CompendiumManager pure functions |
| `tests/compendium-ref-parser.test.ts` | Tests for `{{}}` reference parsing |

### Modified Files
| File | Changes |
|------|---------|
| `src/entities/entity-registry.ts` | Replace `source` with `compendium`, `readonly`, `homebrew` on `RegisteredEntity` |
| `src/entities/entity-vault-store.ts` | New file format: fenced code block body, minimal frontmatter (no `data:`) |
| `src/entities/entity-importer.ts` | Use new format, create `_compendium.md` during SRD import |
| `src/types/settings.ts` | Keep `userEntityFolder` but stop using it |
| `src/settings/settings-tab.ts` | Add compendiums section with list + read-only toggles, remove userEntityFolder |
| `src/main.ts` | New load sequence (CompendiumManager), register `{{}}` extensions, wire onCompendium callbacks |
| `src/edit/side-buttons.ts` | New `"compendium-pending"` state with save/save-as-new/cancel buttons |
| `src/edit/monster-edit-render.ts` | Wire onCompendium + onSaveAsNew callbacks |
| `src/edit/spell-edit-render.ts` | Wire onCompendium + onSaveAsNew callbacks |
| `src/edit/item-edit-render.ts` | Wire onCompendium + onSaveAsNew callbacks |
| `src/inquiry/InquiryModule.ts` | `saveEntityToVault` uses new format + compendium selection |
| `src/ai/mcp-server.ts` | Add `create_compendium` tool |
| `tests/entity-registry.test.ts` | Update for new fields |
| `tests/entity-vault-store.test.ts` | Update for new format |

### Deleted Files
| File | Reason |
|------|--------|
| `src/extensions/entity-editor-suggest.ts` | Replaced by `compendium-suggest.ts` |

---


### Task 1: Update RegisteredEntity and EntityRegistry

**Files:**
- Modify: `src/entities/entity-registry.ts`
- Test: `tests/entity-registry.test.ts`

- [ ] **Step 1: Read existing test file**

Read `tests/entity-registry.test.ts` to understand current test patterns.

- [ ] **Step 2: Update RegisteredEntity interface**

In `src/entities/entity-registry.ts`, replace `source: "srd" | "custom"` with three new fields:

```typescript
export interface RegisteredEntity {
  slug: string;
  name: string;
  entityType: string;
  filePath: string;
  data: Record<string, unknown>;
  compendium: string;    // e.g., "SRD", "Homebrew"
  readonly: boolean;     // from compendium metadata
  homebrew: boolean;     // from compendium metadata
}
```

- [ ] **Step 3: Update tests to use new fields**

In `tests/entity-registry.test.ts`, update all test entity objects. Replace every `source: "srd"` with `compendium: "SRD", readonly: true, homebrew: false`. Replace every `source: "custom"` with `compendium: "Homebrew", readonly: false, homebrew: true`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/entity-registry.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```
git add src/entities/entity-registry.ts tests/entity-registry.test.ts
git commit -m "feat: update RegisteredEntity to use compendium fields instead of source"
```

---

### Task 2: New Entity File Format (entity-vault-store)

**Files:**
- Modify: `src/entities/entity-vault-store.ts`
- Test: `tests/entity-vault-store.test.ts`

- [ ] **Step 1: Read existing files**

Read `src/entities/entity-vault-store.ts` and `tests/entity-vault-store.test.ts` in full.

- [ ] **Step 2: Update EntityNote interface**

In `src/entities/entity-vault-store.ts`, replace `source: "srd" | "custom"` with `compendium: string`:

```typescript
export interface EntityNote {
  slug: string;
  name: string;
  entityType: string;
  compendium: string;
  data: Record<string, unknown>;
}
```

- [ ] **Step 3: Write failing test for new generateEntityMarkdown**

In `tests/entity-vault-store.test.ts`, add a test that expects the new format: frontmatter without `data:` and a fenced code block in the body. The test should check:
- `archivist: true`, `entity_type`, `slug`, `name`, `compendium` in frontmatter
- No `data:` key in frontmatter section
- Body contains a fenced code block like ` ```monster ` with the entity YAML

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/entity-vault-store.test.ts`
Expected: FAIL (old format still has `data:` in frontmatter).

- [ ] **Step 5: Rewrite generateEntityMarkdown**

Replace the function body to output minimal frontmatter + fenced code block:

```typescript
export function generateEntityMarkdown(entity: EntityNote): string {
  const frontmatter: Record<string, unknown> = {
    archivist: true,
    entity_type: entity.entityType,
    slug: entity.slug,
    name: entity.name,
    compendium: entity.compendium,
  };
  const fm = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const codeBlockType = entity.entityType === "magic-item" ? "item" : entity.entityType;
  const body = yaml.dump(entity.data, { lineWidth: -1, noRefs: true, sortKeys: false });
  return `---\n${fm}---\n\n\`\`\`${codeBlockType}\n${body}\`\`\`\n`;
}
```

- [ ] **Step 6: Delete buildBodySummary function**

Remove the entire `buildBodySummary` function -- no longer called.

- [ ] **Step 7: Write failing test for parseEntityFile**

Add test for a new `parseEntityFile` function that parses the new format: reads frontmatter for indexing fields and extracts YAML from the fenced code block.

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run tests/entity-vault-store.test.ts`
Expected: FAIL (`parseEntityFile` not defined).

- [ ] **Step 9: Implement parseEntityFile**

Add `parseEntityFile(content: string): EntityNote | null` that:
1. Parses `---` delimited frontmatter, checks `archivist: true`
2. Extracts `slug`, `name`, `entity_type`, `compendium` from frontmatter
3. Regex-matches ` ```\w+\n([\s\S]*?)``` ` in the body to extract code block YAML
4. Parses the code block YAML as `data`
5. Returns `EntityNote` or `null`

- [ ] **Step 10: Update parseEntityFrontmatter for backward compat**

Make `parseEntityFrontmatter` try `parseEntityFile` first. If that returns null, fall back to the old format (reading `data:` from frontmatter). Map old `source: "srd"` to `compendium: "SRD"` and `source: "custom"` to `compendium: "Homebrew"`.

- [ ] **Step 11: Run all tests**

Run: `npx vitest run tests/entity-vault-store.test.ts`
Expected: All pass.

- [ ] **Step 12: Commit**

```
git add src/entities/entity-vault-store.ts tests/entity-vault-store.test.ts
git commit -m "feat: new entity file format with fenced code blocks instead of data blob"
```

---

### Task 3: CompendiumManager

**Files:**
- Create: `src/entities/compendium-manager.ts`
- Create: `tests/compendium-manager.test.ts`

- [ ] **Step 1: Write failing tests for metadata parsing**

Create `tests/compendium-manager.test.ts` with tests for `parseCompendiumMetadata` and `generateCompendiumMetadata`:
- Parse valid `_compendium.md` with all fields
- Return null for non-compendium files
- Default `readonly` to false and `homebrew` to true when omitted
- Generate valid markdown with all properties

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compendium-manager.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement Compendium interface and pure functions**

Create `src/entities/compendium-manager.ts` with:

`Compendium` interface: `name`, `description`, `readonly`, `homebrew`, `folderPath`

`parseCompendiumMetadata(content, folderPath)`: Parses `_compendium.md` frontmatter. Checks `archivist_compendium: true`. Returns `Compendium | null`.

`generateCompendiumMetadata(comp)`: Generates `_compendium.md` markdown with frontmatter and heading.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/compendium-manager.test.ts`
Expected: All pass.

- [ ] **Step 5: Implement CompendiumManager class**

Add the `CompendiumManager` class with:
- Constructor: takes `EntityRegistry`, Obsidian `Vault`, `compendiumRoot`
- `getAll()`, `getWritable()`, `getByName(name)` -- pure lookups on internal Map
- `addCompendium(comp)` -- add to internal Map
- `discover()` -- scan vault folders, read `_compendium.md` files, populate Map
- `loadAllEntities()` -- iterate compendiums, scan .md files, parse with `parseEntityFile`, register in EntityRegistry
- `create(name, desc, homebrew, readonly)` -- create folder + `_compendium.md`
- `setReadonly(name, value)` -- update metadata file
- `saveEntity(compendiumName, entityType, data)` -- create entity file, register in registry
- `updateEntity(slug, data)` -- update existing entity file, re-register

- [ ] **Step 6: Commit**

```
git add src/entities/compendium-manager.ts tests/compendium-manager.test.ts
git commit -m "feat: add CompendiumManager with metadata parsing and entity CRUD"
```

---

### Task 4: Compendium Reference Parser

**Files:**
- Create: `src/extensions/compendium-ref-extension.ts` (parser only)
- Create: `tests/compendium-ref-parser.test.ts`

- [ ] **Step 1: Write tests for reference parsing**

Create `tests/compendium-ref-parser.test.ts` with tests for `parseCompendiumRef`:
- `{{monster:goblin}}` -> `{ entityType: "monster", slug: "goblin" }`
- `{{spell:fireball}}` -> `{ entityType: "spell", slug: "fireball" }`
- `{{goblin}}` (no prefix) -> `{ entityType: null, slug: "goblin" }`
- `{{item:flame-tongue}}` -> `{ entityType: "item", slug: "flame-tongue" }`
- Non-refs return null: `"hello"`, `"{{}}"`, `"{monster:goblin}"`
- Handles whitespace: `"{{ monster:goblin }}"` -> valid

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compendium-ref-parser.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement parseCompendiumRef**

Create `src/extensions/compendium-ref-extension.ts` with:

```typescript
export interface CompendiumRef {
  entityType: string | null;
  slug: string;
}

const VALID_TYPES = new Set([
  "monster", "spell", "item", "feat", "condition",
  "class", "background", "armor", "weapon",
]);

export function parseCompendiumRef(text: string): CompendiumRef | null {
  const match = text.match(/^\{\{\s*(.+?)\s*\}\}$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner) return null;
  const colonIdx = inner.indexOf(":");
  if (colonIdx === -1) return { entityType: null, slug: inner };
  const prefix = inner.substring(0, colonIdx).trim();
  const slug = inner.substring(colonIdx + 1).trim();
  if (!slug) return null;
  if (!VALID_TYPES.has(prefix)) return { entityType: null, slug: inner };
  return { entityType: prefix, slug };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/compendium-ref-parser.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```
git add src/extensions/compendium-ref-extension.ts tests/compendium-ref-parser.test.ts
git commit -m "feat: add compendium reference parser for {{type:slug}} syntax"
```

---


### Task 5: Update SRD Importer for New Format

**Files:**
- Modify: `src/entities/entity-importer.ts`

- [ ] **Step 1: Read entity-importer.ts**

Read `src/entities/entity-importer.ts` in full.

- [ ] **Step 2: Add import for generateCompendiumMetadata**

Add at top of file:
```typescript
import { generateCompendiumMetadata } from "./compendium-manager";
```

- [ ] **Step 3: Create _compendium.md during SRD import**

After creating the SRD base folder and before iterating entities, add logic to create `_compendium.md` if it doesn't exist:
```typescript
const compMetaPath = `${srdRoot}/_compendium.md`;
if (!vault.getAbstractFileByPath(compMetaPath)) {
  const metaMd = generateCompendiumMetadata({
    name: "SRD",
    description: "D&D 5e System Reference Document",
    readonly: true,
    homebrew: false,
    folderPath: srdRoot,
  });
  await vault.create(compMetaPath, metaMd);
}
```

- [ ] **Step 4: Update entity generation to use new EntityNote format**

In the entity iteration loop, change `generateEntityMarkdown` call to use `compendium: "SRD"` instead of `source: "srd"`.

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 6: Commit**

```
git add src/entities/entity-importer.ts
git commit -m "feat: SRD importer uses new file format and creates _compendium.md"
```

---

### Task 6: CM6 ViewPlugin for {{}} Live Preview

**Files:**
- Modify: `src/extensions/compendium-ref-extension.ts`

- [ ] **Step 1: Read inline-tag-extension.ts for pattern reference**

Read `src/extensions/inline-tag-extension.ts` to understand the CM6 ViewPlugin + WidgetType pattern used in this codebase.

- [ ] **Step 2: Add imports for CM6 and renderers**

Add to `src/extensions/compendium-ref-extension.ts`:
```typescript
import { WidgetType, EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { parseMonster } from "../parsers/monster-parser";
import { parseSpell } from "../parsers/spell-parser";
import { parseItem } from "../parsers/item-parser";
import { renderMonsterBlock } from "../renderers/monster-renderer";
import { renderSpellBlock } from "../renderers/spell-renderer";
import { renderItemBlock } from "../renderers/item-renderer";
import { EntityRegistry } from "../entities/entity-registry";
import * as yaml from "js-yaml";
```

- [ ] **Step 3: Add registry ref setter**

Add module-level registry reference and setter:
```typescript
let registryRef: EntityRegistry | null = null;

export function setCompendiumRefRegistry(registry: EntityRegistry): void {
  registryRef = registry;
}
```

- [ ] **Step 4: Implement CompendiumRefWidget**

Add `CompendiumRefWidget extends WidgetType`:
- Constructor takes `refText: string`
- `eq(other)`: compare `refText`
- `toDOM()`: calls `parseCompendiumRef(this.refText)`, looks up entity via `registryRef.getBySlug(slug)`, verifies entityType if specified, then switches on `entity.entityType` to parse YAML and render stat block using existing renderers. Prepends a compendium badge div. Returns error div if entity not found.

- [ ] **Step 5: Implement buildDecorations and ViewPlugin**

Add `buildCompendiumRefDecorations(view: EditorView): DecorationSet`:
- Iterates `view.visibleRanges`
- Uses regex `\{\{[^}]+\}\}` to find matches in document text
- For each match, adds `Decoration.replace({ widget: new CompendiumRefWidget(matchText) })`

Add exported `compendiumRefPlugin`:
```typescript
export const compendiumRefPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCompendiumRefDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCompendiumRefDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 7: Commit**

```
git add src/extensions/compendium-ref-extension.ts
git commit -m "feat: add CM6 ViewPlugin for {{}} compendium reference rendering"
```

---

### Task 7: {{}} EditorSuggest (Autocomplete)

**Files:**
- Create: `src/extensions/compendium-suggest.ts`
- Delete: `src/extensions/entity-editor-suggest.ts`

- [ ] **Step 1: Create CompendiumEditorSuggest**

Create `src/extensions/compendium-suggest.ts` extending Obsidian's `EditorSuggest<RegisteredEntity>`:

- `TYPE_PREFIXES` map: `monster`, `spell`, `item`, `feat`, `condition`, `class`, `background`, `armor`, `weapon` (maps display prefix to entityType value, with `item` -> `magic-item`)
- `TYPE_ICONS` map: icon names per entity type (using Lucide icon names from Obsidian)
- Constructor takes `app` and `EntityRegistry`
- `onTrigger`: finds last `{{` in text before cursor, checks no `}}` closure, returns trigger info with query = text after `{{`
- `getSuggestions`: extracts optional type prefix before `:`, delegates to `registry.search(searchQuery, entityType, 20)`
- `renderSuggestion`: renders icon + name + type badge + compendium badge
- `selectSuggestion`: replaces trigger range with `{{entityType:slug}}`

- [ ] **Step 2: Delete old entity-editor-suggest.ts**

Delete `src/extensions/entity-editor-suggest.ts`.

- [ ] **Step 3: Commit**

```
git add src/extensions/compendium-suggest.ts
git rm src/extensions/entity-editor-suggest.ts
git commit -m "feat: add CompendiumEditorSuggest for {{}} autocomplete, remove old suggest"
```

---

### Task 8: Compendium Selection Modal

**Files:**
- Create: `src/entities/compendium-modal.ts`

- [ ] **Step 1: Create CompendiumSelectModal**

Create `src/entities/compendium-modal.ts` with two modals:

`CompendiumSelectModal` extends Obsidian `Modal`:
- Constructor: `app`, `compendiums: Compendium[]`, `onSelect: (comp) => void`
- `onOpen()`: renders heading "Select Compendium", description, dropdown of compendium names with descriptions, Save and Cancel buttons

`SaveAsNewModal` extends Obsidian `Modal`:
- Constructor: `app`, `compendiums: Compendium[]`, `defaultName: string`, `onSave: (comp, name) => void`
- `onOpen()`: renders heading "Save As New Entity", text input for name (pre-filled with defaultName), dropdown of writable compendiums, Save and Cancel buttons

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```
git add src/entities/compendium-modal.ts
git commit -m "feat: add CompendiumSelectModal and SaveAsNewModal"
```

---

### Task 9: Update Side Buttons for Compendium References

**Files:**
- Modify: `src/edit/side-buttons.ts`

- [ ] **Step 1: Read side-buttons.ts**

Read `src/edit/side-buttons.ts` in full.

- [ ] **Step 2: Add compendium-pending state**

Update `SideButtonState` to include `"compendium-pending"`.

Add `onSaveAsNew` and `isReadonly` to `SideButtonConfig` interface.

In `renderSideButtons`, add a new branch for `"compendium-pending"` state:
- If NOT readonly: render Save button (Lucide `save` icon, title "Save to compendium", calls `onSave`)
- Always: render Save As New button (Lucide `save` icon with a `+` text overlay span on top-right, title "Save as new entity", calls `onSaveAsNew`)
- Always: render Cancel button (Lucide `x` icon, calls `onCancel`)

The `+` overlay uses CSS class `archivist-plus-overlay` positioned absolute on top-right of the button.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: May warn about missing `onSaveAsNew` in callers. OK for now.

- [ ] **Step 4: Commit**

```
git add src/edit/side-buttons.ts
git commit -m "feat: add compendium-pending side button state with save/save-as-new"
```

---

### Task 10: Wire Everything in main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Read main.ts in full**

Read `src/main.ts`.

- [ ] **Step 2: Update imports**

Add imports:
```typescript
import { CompendiumManager } from "./entities/compendium-manager";
import { CompendiumEditorSuggest } from "./extensions/compendium-suggest";
import { compendiumRefPlugin, setCompendiumRefRegistry, parseCompendiumRef } from "./extensions/compendium-ref-extension";
import { CompendiumSelectModal } from "./entities/compendium-modal";
```
Remove import of `EntityEditorSuggest`.

- [ ] **Step 3: Add CompendiumManager property**

Add to ArchivistPlugin class:
```typescript
compendiumManager: CompendiumManager | null = null;
```

- [ ] **Step 4: Replace entity loading in onload()**

After creating `entityRegistry`, init CompendiumManager:
```typescript
this.compendiumManager = new CompendiumManager(this.entityRegistry, this.app.vault, this.settings.compendiumRoot);
setCompendiumRefRegistry(this.entityRegistry);
```

Remove the old SRD registration loop that registers entities from SrdStore into the registry directly. Remove the `triggerSrdImport()` call at the end of onload. Add call to `this.initializeCompendiums()`.

- [ ] **Step 5: Add initializeCompendiums method**

New async method that:
1. Checks if SRD folder exists; if `srdImported` is true but folder missing, resets `srdImported` to false
2. If `!srdImported`, runs `importSrdToVault()` with progress Notice, sets `srdImported = true`
3. Calls `compendiumManager.discover()` then `compendiumManager.loadAllEntities()`

- [ ] **Step 6: Replace EditorSuggest registration**

Replace `EntityEditorSuggest` with `CompendiumEditorSuggest`:
```typescript
this.registerEditorSuggest(new CompendiumEditorSuggest(this.app, this.entityRegistry));
```

- [ ] **Step 7: Register CM6 compendium ref plugin**

Add to the CM6 extensions:
```typescript
this.registerEditorExtension(compendiumRefPlugin);
```

- [ ] **Step 8: Register {{}} post-processor for Reading mode**

Add a `registerMarkdownPostProcessor` that walks text nodes, finds `{{...}}` patterns via regex, looks up entities, and replaces with rendered stat blocks (same rendering logic as the CM6 widget).

- [ ] **Step 9: Wire onCompendium in code block processors**

Replace `onCompendium: () => {}` in all three code block processors (monster/spell/item) with a function that:
1. Gets writable compendiums from CompendiumManager
2. Opens CompendiumSelectModal
3. On selection: saves entity via `compendiumManager.saveEntity()`
4. Replaces the inline code block with `{{type:slug}}` reference using `ctx.getSectionInfo(el)` and `editor.replaceRange()`
5. Shows success Notice

- [ ] **Step 10: Add onSaveAsNew no-op to side button configs**

Add `onSaveAsNew: () => {}` to each `renderSideButtons` call for inline code blocks (save-as-new only applies to compendium refs).

- [ ] **Step 11: Delete old triggerSrdImport and loadUserEntities**

Remove the `triggerSrdImport()` and `loadUserEntities()` methods.

- [ ] **Step 12: Build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 13: Run all tests**

Run: `npx vitest run`
Expected: All pass.

- [ ] **Step 14: Commit**

```
git add src/main.ts
git commit -m "feat: wire CompendiumManager, {{}} rendering, and compendium save into main.ts"
```

---


### Task 11: Wire Edit Mode Save Flows

**Files:**
- Modify: `src/edit/monster-edit-render.ts`
- Modify: `src/edit/spell-edit-render.ts`
- Modify: `src/edit/item-edit-render.ts`

- [ ] **Step 1: Read monster-edit-render.ts side button wiring**

Read `src/edit/monster-edit-render.ts` lines 95-115 (side button setup area).

- [ ] **Step 2: Add compendiumContext parameter to renderMonsterEditMode**

Add optional parameter:
```typescript
export function renderMonsterEditMode(
  monster: Monster,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
): void
```

- [ ] **Step 3: Update side button state for compendium context**

When `compendiumContext` is provided, use `"compendium-pending"` state instead of `"pending"`. Set `isReadonly` from `compendiumContext.readonly`. Wire:
- `onSave`: serialize via `state.toYaml()`, parse to object, call `plugin.compendiumManager.updateEntity(slug, data)`, show Notice, call `onCancelExit()`
- `onSaveAsNew`: get writable compendiums, open `SaveAsNewModal`, on save call `plugin.compendiumManager.saveEntity()`, replace `{{}}` ref in editor with new slug, show Notice
- `onCancel`: call `onCancelExit()`

- [ ] **Step 4: Apply same pattern to spell-edit-render.ts**

Add `compendiumContext` parameter to `renderSpellEditMode`. Same side button wiring but with `entityType: "spell"`. Uses `yaml.dump(draft)` for serialization.

- [ ] **Step 5: Apply same pattern to item-edit-render.ts**

Add `compendiumContext` parameter to `renderItemEditMode`. Same pattern with `entityType: "item"`.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 7: Commit**

```
git add src/edit/monster-edit-render.ts src/edit/spell-edit-render.ts src/edit/item-edit-render.ts
git commit -m "feat: wire compendium save and save-as-new into edit mode renderers"
```

---

### Task 12: Update Settings Tab

**Files:**
- Modify: `src/settings/settings-tab.ts`

- [ ] **Step 1: Read settings-tab.ts**

Read `src/settings/settings-tab.ts` in full (67 lines).

- [ ] **Step 2: Remove User Entity Folder setting**

Delete the `new Setting(containerEl)` block that renders the "User Entity Folder" setting (the one controlling `userEntityFolder`).

- [ ] **Step 3: Add Compendiums list section**

After the "Compendium Root Folder" setting, add:
1. `h3` heading: "Compendiums"
2. Description paragraph explaining what read-only means (from the spec)
3. Iterate `plugin.compendiumManager.getAll()`, for each compendium render a `Setting` with:
   - Name: compendium name
   - Description: `"{description} -- {N} entities"` with homebrew badge if applicable
   - Toggle: read-only switch, calls `compendiumManager.setReadonly(name, value)` on change

Count entities per compendium by filtering the registry.

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 5: Commit**

```
git add src/settings/settings-tab.ts
git commit -m "feat: add compendium list with read-only toggles to settings tab"
```

---

### Task 13: Update Chat Save Flow

**Files:**
- Modify: `src/inquiry/InquiryModule.ts`

- [ ] **Step 1: Read InquiryModule.saveEntityToVault**

Read `src/inquiry/InquiryModule.ts` lines 1324-1372 (the `saveEntityToVault` method).

- [ ] **Step 2: Update saveEntityToVault**

Change method to use CompendiumManager instead of direct vault writes:
1. Accept optional `compendiumName` parameter
2. If not specified and only 1 writable compendium, use it automatically
3. If not specified and multiple writable compendiums, open `CompendiumSelectModal` and recursively call self with selected compendium
4. Call `compendiumManager.saveEntity(compendiumName, entityType, data)`
5. Show success Notice

Add import for `CompendiumSelectModal`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 4: Commit**

```
git add src/inquiry/InquiryModule.ts
git commit -m "feat: update chat save to use CompendiumManager with compendium selection"
```

---

### Task 14: Add create_compendium MCP Tool

**Files:**
- Modify: `src/ai/mcp-server.ts`
- Modify: `src/inquiry/InquiryModule.ts` (factory call)

- [ ] **Step 1: Read mcp-server.ts**

Read `src/ai/mcp-server.ts` in full (29 lines).

- [ ] **Step 2: Update createArchivistMcpServer signature**

Add optional `compendiumManager` parameter:
```typescript
export function createArchivistMcpServer(srdStore: SrdStore, compendiumManager?: any)
```

- [ ] **Step 3: Register create_compendium tool**

Add after existing tool registrations:
- Tool name: `create_compendium`
- Description: `"Create a new compendium for organizing D&D entities"`
- Input schema: `name` (string, required), `description` (string), `readonly` (boolean, default false), `homebrew` (boolean, default true)
- Handler: calls `compendiumManager.create(name, description, homebrew, readonly)`, returns success JSON

- [ ] **Step 4: Update factory call in InquiryModule**

In `InquiryModule.init()`, update the MCP server factory to pass compendiumManager:
```typescript
this.createArchivistMcpServerInstance = () => createArchivistMcpServer(srdStore, plugin.compendiumManager);
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 6: Commit**

```
git add src/ai/mcp-server.ts src/inquiry/InquiryModule.ts
git commit -m "feat: add create_compendium MCP tool for Claudian"
```

---

### Task 15: CSS for Compendium References

**Files:**
- Modify: `src/styles/archivist-dnd.css`

- [ ] **Step 1: Read current CSS file header**

Read `src/styles/archivist-dnd.css` lines 1-30 to understand existing patterns.

- [ ] **Step 2: Add compendium reference styles**

Append to `src/styles/archivist-dnd.css`:

- `.archivist-compendium-ref` -- wrapper, margin 8px 0
- `.archivist-compendium-badge` -- positioned absolute top-right, small uppercase text, parchment-themed (crimson on tan background)
- `.archivist-ref-error` -- dashed border, parchment background, crimson italic text for broken references
- `.archivist-side-btn-save-as-new` -- position relative for overlay
- `.archivist-plus-overlay` -- absolute positioned top-right of button, small bold `+` on parchment circle
- `.archivist-suggest-item` -- flex row for autocomplete dropdown items
- `.archivist-suggest-icon`, `.archivist-suggest-name`, `.archivist-suggest-type`, `.archivist-suggest-compendium` -- autocomplete item parts

Use the design system colors: `#fdf1dc` background, `#922610` crimson, `#d9c484` tan borders.

- [ ] **Step 3: Commit**

```
git add src/styles/archivist-dnd.css
git commit -m "feat: add CSS for compendium references, badges, and autocomplete"
```

---

### Task 16: Build, Deploy, and Smoke Test

**Files:** None (integration test)

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Compiles with no errors.

- [ ] **Step 3: Deploy to Obsidian**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/`

- [ ] **Step 4: User deletes old compendium folders**

The user should delete `Compendium/SRD/` and `Compendium/me/` from the vault.

- [ ] **Step 5: Reload Obsidian and verify SRD import**

Reload Obsidian. The plugin should:
1. Detect SRD folder is missing, reset `srdImported`
2. Re-import SRD with new format (fenced code blocks)
3. Create `SRD/_compendium.md` with `readonly: true`
4. Open any SRD entity file -- should show full rendered stat block, not raw JSON

- [ ] **Step 6: Verify {{}} autocomplete**

In any note, type `{{monster:gob` -- autocomplete dropdown should appear with Goblin. Select it -- should insert `{{monster:goblin}}` which renders as a full parchment stat block.

- [ ] **Step 7: Verify edit flow on a {{}} reference**

Click Edit on a rendered `{{monster:goblin}}` stat block. Since SRD is read-only, only "Save As New" should be available. Click it -- should prompt for compendium and name.

- [ ] **Step 8: Verify inline block "Add to Compendium"**

Write a ` ```monster ` code block with inline YAML. Click the "Add to Compendium" side button. Should prompt which compendium, save the entity, and replace the code block with a `{{monster:slug}}` reference.

- [ ] **Step 9: Verify settings tab**

Open Archivist settings. The Compendiums section should list SRD with entity count and a read-only toggle.

- [ ] **Step 10: Commit final state**

```
git add -A
git commit -m "feat: compendium reference system - complete implementation"
```

