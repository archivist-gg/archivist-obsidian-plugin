# SRD Store + Entity Persistence + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle all D&D 5e SRD content, enable saving AI-generated entities as vault notes, add entity autocomplete in AI chat, and fix three blocking bugs.

**Architecture:** SRD data bundled as JSON arrays loaded into an in-memory SrdStore on plugin load. EntityRegistry merges SRD data with user-saved entity vault notes. EntityAutocomplete provides [[-triggered dropdown in AI chat. Entity notes use YAML frontmatter with an archivist: true flag. First-load SRD import generates vault notes for all SRD entities.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild (bundles JSON natively), Vitest, js-yaml

---

### Task 1: Fix Bug -- Chat Messages Rendering Bottom-to-Top

The messages container uses display: flex; flex-direction: column but messages appear bottom-to-top. The likely cause is justify-content or similar CSS rule on the messages container pushing content to the bottom.

**Files:**
- Modify: `styles.css` (messages container styles)

- [ ] **Step 1: Read the messages container CSS and identify the issue**

Read styles.css and search for .archivist-inquiry-messages. Look for any justify-content, align-items, or min-height rules that could push content to the bottom. Also check if the welcome screen's centering styles leak into the messages container.

- [ ] **Step 2: Apply the CSS fix**

Ensure the messages container has explicit top-alignment:

```css
.archivist-inquiry-messages {
  justify-content: flex-start;
}
```

If the welcome screen uses flex centering, scope it so it doesn't affect messages:

```css
.archivist-inquiry-welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npm run build`
Expected: Build succeeds. Messages render top-to-bottom.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "fix: messages rendering top-to-bottom instead of bottom-to-top"
```

---

### Task 2: Fix Bug -- User Messages Not Displayed

When user sends a message, it should appear in the chat immediately. The flow is: sendMessage -> mgr.addMessage -> this.render -> renderChatMessages loops through messages. The likely cause: the cached tabContainers DOM is re-attached (without the new message) instead of rendering fresh.

**Files:**
- Modify: `src/ui/inquiry-view.ts` (sendMessage method, around line 335)

- [ ] **Step 1: Investigate and apply the fix**

In src/ui/inquiry-view.ts sendMessage(), before this.render() at line 345, delete the cached container so render() builds a fresh one with the new user message:

```typescript
// Clear cached DOM so render() builds fresh with the new user message
if (activeId) this.tabContainers.delete(activeId);
this.isStreaming = true;
if (activeId) this.tabStreamingState.set(activeId, "streaming");
this.render();
```

- [ ] **Step 2: Build and verify**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npm run build`
Expected: Build succeeds. User messages appear immediately after sending.

- [ ] **Step 3: Commit**

```bash
git add src/ui/inquiry-view.ts
git commit -m "fix: user messages now appear immediately after sending"
```

---

### Task 3: Fix Bug -- Generated Entity Blocks Not Rendering

Entity blocks (monster/spell/item) are shown as raw YAML instead of styled stat blocks. Debug the pipeline: tool_result -> JSON parse -> renderGeneratedBlock -> renderMonsterBlock/renderSpellBlock/renderItemBlock.

**Files:**
- Modify: `src/ui/components/message-renderer.ts` (renderGeneratedBlock, around line 475)
- Modify: `src/ui/inquiry-view.ts` (tool_result handler, around line 566)
- Possibly: renderer files in `src/renderers/`

- [ ] **Step 1: Investigate the rendering pipeline**

Read the tool_result handler in inquiry-view.ts lines 566-600. The flow:
1. JSON.parse(event.toolResult) parses the tool result
2. Checks parsed.type and parsed.data and ["monster", "spell", "item"].includes(parsed.type)
3. If match: calls genBlock.handle.updateFromResult(parsed.type, parsed.data)

Check what format the AI actually returns. The tool result may not match the expected { type, data } structure. Also check if the renderers throw exceptions (the catch at line 484 silently swallows errors).

Add console.error to the catch block so errors are visible:

```typescript
} catch (err) {
  console.error("Failed to render entity block:", err, entity);
  parent.createDiv({ cls: "archivist-inquiry-msg-error", text: "Failed to render block" });
}
```

Also handle the case where the AI returns flat entity data (not wrapped in { type, data }):

```typescript
// In tool_result handler, after the existing parsed.type check:
if (!parsed.type && parsed.name) {
  // Try to detect entity type from the tool name
  const toolName = /* get from the event or tracked tool call */;
  const entityType = getEntityType(toolName);
  if (entityType) {
    generatedEntity = { type: entityType, data: parsed };
    contentBlocks.push({ type: "generated_entity", entityType, data: parsed });
    const genBlock = toolId ? generatedBlocks.get(toolId) : undefined;
    if (genBlock) {
      genBlock.handle.updateFromResult(entityType, parsed);
    } else {
      const blockWrapper = streamContainer.createDiv({ cls: "archivist-inquiry-stat-block" });
      renderGeneratedBlock(blockWrapper, generatedEntity);
    }
  }
}
```

- [ ] **Step 2: Check data format mismatch between AI output and renderers**

Read the renderer files (src/renderers/monster-renderer.ts, spell-renderer.ts, item-renderer.ts) and the entity type definitions (src/types/monster.ts, spell.ts, item.ts). Compare with what the AI tool generates (src/ai/tools/generation-tools.ts and src/ai/validation/entity-enrichment.ts).

If there's a mismatch, add a normalization layer in renderGeneratedBlock that maps the AI output format to the renderer's expected format.

- [ ] **Step 3: Run tests and build**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npm test && npm run build`
Expected: All tests pass, build succeeds. Entity blocks render as styled stat blocks.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/message-renderer.ts src/ui/inquiry-view.ts
git commit -m "fix: entity blocks now render as styled stat blocks"
```

---

### Task 4: Bundle SRD Data Files

Copy all.json from each SRD directory in the original Archivist app into the plugin source. Each file is a JSON array of entities. Total ~2.4MB. esbuild handles JSON imports natively.

**Files:**
- Create: `src/srd/data/monsters.json` (copy from original Archivist)
- Create: `src/srd/data/spells.json`
- Create: `src/srd/data/magicitems.json`
- Create: `src/srd/data/armor.json`
- Create: `src/srd/data/weapons.json`
- Create: `src/srd/data/feats.json`
- Create: `src/srd/data/conditions.json`
- Create: `src/srd/data/classes.json`
- Create: `src/srd/data/backgrounds.json`

- [ ] **Step 1: Create directory and copy files**

```bash
mkdir -p /Users/shinoobi/w/archivist-obsidian/src/srd/data
SRD=/Users/shinoobi/w/archivist/server/data/srd
DEST=/Users/shinoobi/w/archivist-obsidian/src/srd/data
cp "$SRD/monsters/all.json" "$DEST/monsters.json"
cp "$SRD/spells/all.json" "$DEST/spells.json"
cp "$SRD/magicitems/all.json" "$DEST/magicitems.json"
cp "$SRD/armor/all.json" "$DEST/armor.json"
cp "$SRD/weapons/all.json" "$DEST/weapons.json"
cp "$SRD/feats/all.json" "$DEST/feats.json"
cp "$SRD/conditions/all.json" "$DEST/conditions.json"
cp "$SRD/classes/all.json" "$DEST/classes.json"
cp "$SRD/backgrounds/all.json" "$DEST/backgrounds.json"
```

- [ ] **Step 2: Verify and build**

```bash
ls -lh /Users/shinoobi/w/archivist-obsidian/src/srd/data/
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Expected: 9 JSON files totaling ~2.4MB. Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/srd/data/
git commit -m "feat: bundle SRD data files (monsters, spells, items, armor, weapons, feats, conditions, classes, backgrounds)"
```

---

### Task 5: Rewrite SrdStore for Full Entity Types

Replace the existing minimal SrdStore with a full implementation supporting all 9 entity types, slug-based lookup, and ranked search.

**Files:**
- Modify: `src/ai/srd/srd-store.ts`
- Modify: `tests/srd-store.test.ts`
- Modify: `src/main.ts` (update SrdStore initialization)
- Modify: `src/ai/agent-service.ts` (update if using old SrdStore API)

- [ ] **Step 1: Write failing tests**

Replace tests/srd-store.test.ts with tests for the new API: loadFromData(), getBySlug(), search() with entityType filter, getAllOfType(), getTypes(), count(). Use test data with multiple entity types including monsters, spells, items, and conditions. Test ranking: exact match first, starts-with second, contains third. Test slug-based retrieval. Test case-insensitive search. Test limit parameter.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npx vitest run tests/srd-store.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement new SrdStore**

Rewrite src/ai/srd/srd-store.ts with:
- SrdEntity interface: slug, name, entityType, data
- SrdDataSources type: Record<string, Record<string, unknown>[]>
- TYPE_MAP: maps directory names (monsters, spells, magicitems, etc.) to canonical type names (monster, spell, magic-item, etc.)
- loadFromData(sources): parses all sources into bySlug Map and byType Map
- loadFromBundledJson(): imports bundled JSON files via require() and calls loadFromData
- getBySlug(slug): O(1) lookup
- search(query, entityType?, limit?): case-insensitive substring match, ranked (exact > starts-with > contains), default limit 20
- getAllOfType(entityType): returns array
- getTypes(): returns type names
- count(): returns total entity count

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npx vitest run tests/srd-store.test.ts`
Expected: All PASS

- [ ] **Step 5: Update main.ts**

Change SrdStore initialization to call loadFromBundledJson():
```typescript
this.srdStore = new SrdStore();
this.srdStore.loadFromBundledJson();
```

- [ ] **Step 6: Update agent-service.ts**

Check for any calls to old SrdStore methods (loadFromArrays, getByName). Update to use new API (getBySlug, search with new signature).

- [ ] **Step 7: Run full test suite and build**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npm test && npm run build`
Expected: All pass, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/ai/srd/srd-store.ts tests/srd-store.test.ts src/main.ts src/ai/agent-service.ts
git commit -m "feat: rewrite SrdStore for full SRD entity types with slug-based lookup"
```

---

### Task 6: Add Compendium Settings

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/settings/settings-tab.ts`

- [ ] **Step 1: Update settings interface**

Add to ArchivistSettings: compendiumRoot (default "Compendium"), userEntityFolder (default "me"), srdImported (default false). Update DEFAULT_SETTINGS.

- [ ] **Step 2: Add settings UI**

Add an "Entity Compendium" section to settings-tab.ts with text inputs for compendium root and user entity folder.

- [ ] **Step 3: Build and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
git add src/types/settings.ts src/settings/settings-tab.ts
git commit -m "feat: add compendium folder settings"
```

---

### Task 7: Entity Vault Store

Module for reading/writing entity notes as Obsidian vault files with YAML frontmatter.

**Files:**
- Create: `src/entities/entity-vault-store.ts`
- Create: `tests/entity-vault-store.test.ts`

- [ ] **Step 1: Write failing tests**

Test slugify(), generateEntityMarkdown(), parseEntityFrontmatter(), ensureUniqueSlug(). Verify YAML frontmatter includes archivist: true, entity_type, slug, name, source, data. Verify markdown body has heading and summary stats. Verify parseEntityFrontmatter returns null for non-archivist notes. Verify slug uniqueness appends -custom, -custom-2, etc.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement entity-vault-store.ts**

Export: EntityNote interface (slug, name, entityType, source, data), slugify(name), ensureUniqueSlug(baseSlug, existingSlugs), generateEntityMarkdown(entity), parseEntityFrontmatter(content), TYPE_FOLDER_MAP constant mapping entity types to folder names (monster->Monsters, spell->Spells, magic-item->Magic Items, etc.).

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/entities/entity-vault-store.ts tests/entity-vault-store.test.ts
git commit -m "feat: entity vault store with markdown generation and frontmatter parsing"
```

---

### Task 8: Entity Importer (First-Load SRD Import)

Generates vault notes for all SRD entities on first plugin load with progress notice.

**Files:**
- Create: `src/entities/entity-importer.ts`

- [ ] **Step 1: Implement the importer**

Export importSrdToVault(vault, srdStore, compendiumRoot, onProgress?) that: iterates all SRD entities from SrdStore, creates type subfolders under Compendium/SRD/, generates markdown note per entity via generateEntityMarkdown, skips existing files (resume support), sanitizes filenames, reports progress via callback every 50 entities. Returns count of imported entities.

- [ ] **Step 2: Build and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
git add src/entities/entity-importer.ts
git commit -m "feat: SRD entity importer for first-load vault note generation"
```

---

### Task 9: Entity Registry

Unified registry merging SRD and user-saved entities into a single searchable Map.

**Files:**
- Create: `src/entities/entity-registry.ts`
- Create: `tests/entity-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Test register(), getBySlug(), search() with and without type filter, getTypes(), getAllSlugs(), count(). Verify search ranking (exact > starts-with > contains). Verify limit default of 20.

- [ ] **Step 2: Implement EntityRegistry**

Export RegisteredEntity interface (slug, name, entityType, source, filePath, data) and EntityRegistry class with: register(entity), getBySlug(slug), search(query, entityType?, limit?), getTypes(), getAllSlugs(), count(), clear(). Uses Map<string, RegisteredEntity> keyed by slug and Map<string, RegisteredEntity[]> keyed by type.

- [ ] **Step 3: Run tests and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npx vitest run tests/entity-registry.test.ts
git add src/entities/entity-registry.ts tests/entity-registry.test.ts
git commit -m "feat: unified entity registry merging SRD and user entities"
```

---

### Task 10: Wire SRD Store, Importer, and Registry into Plugin

Connect all entity infrastructure to the plugin lifecycle.

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add imports and fields**

Import EntityRegistry, importSrdToVault, parseEntityFrontmatter, TYPE_FOLDER_MAP, Notice. Add entityRegistry field to the plugin class.

- [ ] **Step 2: Initialize in onload()**

After SrdStore.loadFromBundledJson(): create EntityRegistry, populate from SrdStore (iterate all types and entities, register each with filePath computed from settings.compendiumRoot + /SRD/ + TYPE_FOLDER_MAP[type] + /name.md).

If !settings.srdImported: call importSrdToVault with progress notice, then set srdImported=true and call loadUserEntities(). Else: just call loadUserEntities().

- [ ] **Step 3: Add loadUserEntities() method**

Scans vault files under compendiumRoot/userEntityFolder, parses frontmatter with parseEntityFrontmatter, registers entities with source "custom".

- [ ] **Step 4: Build and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
git add src/main.ts
git commit -m "feat: wire SRD store, entity importer, and registry into plugin lifecycle"
```

---

### Task 11: Copy and Save Button + Source Badge

Replace "Copy to Clipboard" with "Copy & Save" that also creates a vault note. Add source badge on entity blocks.

**Files:**
- Modify: `src/ui/components/message-renderer.ts`
- Modify: `src/ui/inquiry-view.ts`
- Modify: `styles.css`

- [ ] **Step 1: Update renderGeneratedBlock**

Change signature to accept optional source ("srd" | "custom") and optional onCopyAndSave callback. Add source badge div before the copy button. Replace "Copy to Clipboard" button with "Copy & Save" using copy-plus icon. On click: copy YAML to clipboard, then call onCopyAndSave if provided to create vault note, show "Saved!" state for 2s.

- [ ] **Step 2: Implement saveEntityToVault in inquiry-view.ts**

Add method that: generates slug from entity name, ensures uniqueness via registry.getAllSlugs(), creates directory if needed, creates vault note via vault.create(), registers in EntityRegistry, shows Notice with save path. Pass this as callback to renderGeneratedBlock calls throughout the file.

- [ ] **Step 3: Add CSS for source badge**

Small inline pill badge with Lucide icon. .archivist-entity-source-srd uses muted colors, .archivist-entity-source-custom uses brand color.

- [ ] **Step 4: Build and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
git add src/ui/components/message-renderer.ts src/ui/inquiry-view.ts styles.css
git commit -m "feat: Copy & Save button saves entities to vault, add source badge"
```

---

### Task 12: UI Polish -- Header Icon Sizes

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Update header icon sizes**

Find the header button icon sizing in styles.css (currently 14px). Change to 16px:

```css
.archivist-inquiry-header-actions .clickable-icon svg {
  width: 16px;
  height: 16px;
}
```

Use the actual selector present in styles.css.

- [ ] **Step 2: Build and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
git add styles.css
git commit -m "fix: increase header icon sizes from 14px to 16px"
```

---

### Task 13: Fix @ Mention and / Slash Command Dropdowns

Both dropdowns exist in code but don't appear when typing. Debug and fix.

**Files:**
- Modify: `src/ui/components/mention-dropdown.ts`
- Modify: `src/ui/components/slash-commands.ts`
- Modify: `src/ui/components/chat-input.ts`
- Modify: `styles.css`

- [ ] **Step 1: Investigate**

The dropdowns are instantiated in chat-input.ts. Check:
1. Is state.vaultFiles populated? (Check inquiry-view.ts passes vault files)
2. Are event listeners attached to the correct textarea? (renderChatInput creates new textarea each time)
3. Is the dropdown positioned correctly? (parent needs position: relative, dropdown needs position: absolute and high z-index)
4. Is the dropdown CSS present in styles.css?
5. Add console.log in the check() method of both dropdowns to see if detection triggers

Most likely issue: the inputWrapper needs position: relative for absolute dropdown positioning to work. Verify and add if missing:

```css
.archivist-inquiry-input-wrapper {
  position: relative;
}
```

- [ ] **Step 2: Apply fixes and build**

Fix whatever the investigation reveals. Common fixes: add position: relative to input wrapper, ensure z-index is high enough, ensure event listeners fire on the correct textarea element.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/mention-dropdown.ts src/ui/components/slash-commands.ts src/ui/components/chat-input.ts styles.css
git commit -m "fix: @mention and /slash command dropdowns now appear correctly"
```

---

### Task 14: Entity Autocomplete ([[ trigger) in AI Chat

New dropdown triggered by [[ in the AI chat textarea, with type prefix filtering and entity context injection for the AI.

**Files:**
- Create: `src/ui/components/entity-autocomplete.ts`
- Modify: `src/ui/components/chat-input.ts`
- Modify: `src/ui/inquiry-view.ts`
- Modify: `src/ai/agent-service.ts`
- Modify: `styles.css`

- [ ] **Step 1: Implement EntityAutocomplete class**

Create src/ui/components/entity-autocomplete.ts following the same pattern as MentionDropdown. Key differences:
- Trigger: [[ instead of @
- Type prefix filtering: [[monster: filters to monsters, [[spell: to spells, [[doc: to vault files, etc.
- Results show type icon + name + source badge (SRD/Custom/Doc)
- On selection: inserts [[type:Name]] into textarea, tracks selected entities for context injection
- Mixed results: when no type prefix and query exists, shows entities + up to 5 vault files

PREFIX_MAP: { "monster:": "monster", "spell:": "spell", "item:": "magic-item", "armor:": "armor", "weapon:": "weapon", "feat:": "feat", "condition:": "condition", "class:": "class", "background:": "background", "doc:": "doc" }

TYPE_ICONS: { monster: "sword", spell: "sparkles", "magic-item": "gem", armor: "shield", weapon: "swords", feat: "star", condition: "alert-triangle", class: "users", background: "scroll", doc: "file-text" }

- [ ] **Step 2: Integrate into chat-input.ts**

Add entitySearch and onEntitySelect to ChatInputState and ChatInputCallbacks. Instantiate EntityAutocomplete after the slash command dropdown, passing the search function and vault files getter.

- [ ] **Step 3: Wire in inquiry-view.ts**

Pass entitySearch callback that calls entityRegistry.search(). In sendMessage(), resolve [[type:name]] references in the message text, look up entity data from registry, serialize as YAML wrapped in entity-context tags, append to the context passed to agent.sendMessage().

- [ ] **Step 4: Update agent-service.ts**

Accept entityContext in the context parameter. If present, append to the system prompt: "The user has referenced the following entities:" followed by the entity context blocks.

- [ ] **Step 5: Add CSS styles**

Style the entity dropdown matching the existing mention/slash dropdown patterns: position absolute, bottom: 100%, max-height 300px, z-index 100. Style items with icon, name, and source badge. Active state highlight.

- [ ] **Step 6: Build and commit**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm test && npm run build
git add src/ui/components/entity-autocomplete.ts src/ui/components/chat-input.ts src/ui/inquiry-view.ts src/ai/agent-service.ts styles.css
git commit -m "feat: [[ entity autocomplete in AI chat with type prefix filtering and context injection"
```

---

### Task 15: Final Integration and Full Test

Ensure all pieces work together.

**Files:**
- All files from prior tasks

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npm test`
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `cd /Users/shinoobi/w/archivist-obsidian && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Verify plugin bundle size**

```bash
ls -lh /Users/shinoobi/w/archivist-obsidian/main.js
```

Expected: File is larger than before (~2-3MB additional from SRD data).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration -- all features wired and building"
```
