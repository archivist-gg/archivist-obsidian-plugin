# Compendium Reference System Design

**Date:** 2026-04-04
**Status:** Approved

## Overview

Redesign the compendium system to create a meaningful connection between stat blocks in notes and entities stored in the compendium. Entities are stored as markdown files with fenced code blocks (rendering full parchment stat blocks in Obsidian). A new `{{type:slug}}` reference syntax lets users embed live stat blocks from the compendium anywhere in their vault, with type-filtered autocomplete. Editing a referenced block offers "Save" (update the compendium source, all references reflect the change) or "Save As New" (create a new entity in a writable compendium). Compendiums have per-folder read-only settings managed via a `_compendium.md` metadata file.

## Compendium Structure

### Folder Layout

Each top-level folder under `compendiumRoot` (default: `Compendium/`) is a compendium. Type subfolders (`Monsters/`, `Spells/`, `Items/`, etc.) are created on demand when entities are saved.

```
Vault/
  Compendium/
    SRD/
      _compendium.md          # metadata: readonly=true, homebrew=false
      Monsters/
        Goblin.md
        Ancient Red Dragon.md
      Spells/
        Fireball.md
      Magic Items/
        ...
    Homebrew/
      _compendium.md          # metadata: readonly=false, homebrew=true
      Monsters/
        Duskfang Stalker.md
    Curse of Strahd/
      _compendium.md          # metadata: readonly=false, homebrew=true
      Monsters/
      Items/
```

### Compendium Metadata: `_compendium.md`

Each compendium folder contains a `_compendium.md` file -- a regular Obsidian note with frontmatter properties. This is the source of truth for compendium configuration. Users can edit it directly in Obsidian's properties panel.

```yaml
---
archivist_compendium: true
name: SRD
description: D&D 5e System Reference Document
readonly: true
homebrew: false
---

# SRD

Official D&D 5e open-license content.
```

Properties:
- `archivist_compendium: true` -- identifies this as a compendium metadata file
- `name` -- display name
- `description` -- shown in settings
- `readonly` -- when true, entities cannot be modified (edit mode only offers "Save As New")
- `homebrew` -- identifies user-created/homebrew compendiums vs official content

### Entity File Format (New)

Entity files use minimal frontmatter for indexing and a fenced code block for the entity data. The plugin renders the code block as a full parchment stat block.

```markdown
---
archivist: true
entity_type: monster
slug: goblin
name: Goblin
compendium: SRD
---

```monster
name: Goblin
size: Small
type: humanoid (goblinoid)
alignment: neutral evil
ac: 15 (leather armor, shield)
hp: 7 (2d6)
speed: 30 ft.
...
```
```

Key changes from old format:
- `data:` blob removed from frontmatter (was causing `[object Object]` display issues and ugly JSON in properties panel)
- `source: "srd" | "custom"` replaced by `compendium` field (name of the compendium)
- Entity data lives in the fenced code block -- same format as inline stat blocks in notes
- Opening the file in Obsidian shows the full rendered parchment stat block

## `{{}}` Reference System

### Syntax

```
{{monster:goblin}}       # with type prefix (recommended)
{{spell:fireball}}
{{item:flame-tongue}}
{{goblin}}               # without prefix (searches all types)
```

The value inside is the entity's slug. The type prefix is optional but recommended for clarity and faster lookup. If no prefix is given and multiple entities share a slug across types, the first registered match wins (SRD entities load first, then compendiums alphabetically).

### Autocomplete

Typing `{{` in the editor triggers an `EditorSuggest` autocomplete dropdown. Behavior:

1. `{{` alone shows all entities (limited to top 20)
2. `{{monster:` filters to monsters only
3. `{{spell:` filters to spells only
4. `{{item:` filters to items only
5. Additional type prefixes supported: `feat`, `condition`, `class`, `background`, `armor`, `weapon`
6. Typing further narrows results (ranked: exact match > starts-with > contains)
7. Each suggestion shows: Lucide icon + entity name + type badge + compendium badge
8. Selecting a suggestion inserts `{{type:slug}}`

This replaces the existing `EntityEditorSuggest` which used `[[type:name]]` syntax in the editor. The chat autocomplete (`[[` in Inquiry sidebar) remains unchanged -- it serves a different purpose (AI context, not stat block rendering).

### Rendering Pipeline

`{{type:slug}}` is rendered as a full parchment stat block via two complementary mechanisms:

**Live Preview (CM6 ViewPlugin):**
- A `ViewPlugin` scans the document for `{{...}}` patterns
- Replaces each match with a widget decoration that renders the stat block
- Uses the same parser/renderer pipeline as inline code blocks: `parseMonster(yaml)` -> `renderMonsterBlock(data, el)`
- Clicking into the decoration reveals the source text for editing
- Same architectural pattern as the existing `inline-tag-extension.ts`

**Reading Mode (Markdown Post-Processor):**
- `registerMarkdownPostProcessor` scans rendered HTML for `{{...}}` text nodes
- Replaces with rendered stat block containers
- No edit capability (reading mode is read-only)

**Broken references:** If `{{monster:deleted-thing}}` can't find the entity in the registry, it renders a styled error placeholder: "Entity not found: monster:deleted-thing" with a dashed border in the parchment theme.

**Compendium context:** Rendered blocks from `{{}}` references know they are compendium references (not inline blocks). They display a small compendium badge (e.g., "SRD") and show appropriate save options in their side buttons.

## Edit & Save Flow

### Editing a `{{}}` Reference

Clicking Edit on a stat block rendered from `{{monster:goblin}}` enters the same interactive edit mode as inline code blocks (dashed borders, custom spinners, editable fields). The block shows a compendium badge indicating its source.

Side buttons adapt to the compendium's read-only status:

**Writable compendium:**
- Save (update compendium source) -- uses a save icon
- Save As New (create new entity) -- uses the same save icon with a `+` overlay on the top-right corner
- Cancel

**Read-only compendium (e.g., SRD):**
- Save -- disabled/hidden (read-only)
- Save As New -- only option (same save icon with `+` overlay)
- Cancel

### Save (Update Source)

1. Serialize the edited entity back to YAML
2. Update the compendium `.md` file's code block
3. Update the entity in the in-memory registry
4. All `{{}}` references across the vault automatically reflect the change on next render

Single source of truth -- one write, all references update.

### Save As New

1. Obsidian modal prompt: "Which compendium?" -- dropdown listing only writable compendiums
2. Obsidian modal prompt: "Name?" -- pre-filled with current name, user can change
3. Generate new slug, create new `.md` file in the chosen compendium
4. Register new entity in the registry
5. Update the `{{}}` reference in the current note to point to the new slug

Original entity unchanged. New entity created. Current reference updated.

### Inline Code Block -> Compendium

The "Add to Compendium" side button on regular ` ```monster ` / ` ```spell ` / ` ```item ` code blocks (currently a no-op) is wired up:

1. User clicks "Add to Compendium" side button
2. Prompt: "Which compendium?" -- dropdown of writable compendiums
3. Entity saved to compendium as a new `.md` file with the new format
4. Registered in entity registry
5. Inline code block in the note replaced with `{{type:slug}}` reference
6. The reference immediately renders as the same stat block

### Save from Chat (Claudian)

The existing "Copy & Save" button in the Inquiry chat is updated:
- Prompts "Which compendium?" -- dropdown of writable compendiums (instead of hardcoding the `me/` folder)
- Saves using the new file format (fenced code block, minimal frontmatter)
- Registers in entity registry with compendium metadata

## Entity Registry Changes

### Updated `RegisteredEntity` Interface

```typescript
interface RegisteredEntity {
  slug: string;
  name: string;
  entityType: string;           // "monster", "spell", "item", etc.
  filePath: string;             // vault-relative path to .md
  data: Record<string, unknown>;// parsed YAML from the code block
  compendium: string;           // compendium name, e.g., "SRD", "Homebrew"
  readonly: boolean;            // from compendium metadata
  homebrew: boolean;            // from compendium metadata
}
```

Replaces the old `source: "srd" | "custom"` with `compendium`, `readonly`, and `homebrew` -- supports N compendiums.

### Plugin Load Sequence

1. **Discover compendiums** -- scan top-level folders under `compendiumRoot`. Read each `_compendium.md` for metadata. Build a `CompendiumManager`.
2. **SRD import (if needed)** -- if `srdImported` is false, run SRD import using the new file format. Create `SRD/_compendium.md` with `readonly: true`, `homebrew: false`.
3. **Load all entities from all compendiums** -- for each compendium, scan `.md` files (excluding `_compendium.md`), parse frontmatter + fenced code block, register in `EntityRegistry` with compendium metadata.
4. **Ready** -- registry populated, `{{}}` references resolve, autocomplete works.

### New: `CompendiumManager`

A new module that owns compendium-level operations:

- `getAll()` -- list all compendiums with metadata
- `getWritable()` -- only writable compendiums (for save dropdowns)
- `getByName(name)` -- look up a specific compendium
- `create(name, description, homebrew, readonly)` -- create folder + `_compendium.md`
- `setReadonly(name, value)` -- toggle readonly, writes to `_compendium.md`
- `saveEntity(compendiumName, entityType, data)` -- save entity to a compendium
- `updateEntity(slug, data)` -- update existing entity's code block

`SrdStore` remains for bundled JSON data (used during SRD import and by MCP tools like `search_srd`). But `EntityRegistry` is the single source of truth for all entity lookups across all compendiums.

## Settings Tab

### Compendiums Section

The plugin settings tab gets a new "Compendiums" section:

- **Header description:** "Compendiums are collections of D&D entities (monsters, spells, items) stored as folders in your vault. **Read-only** compendiums cannot be modified -- editing an entity from a read-only compendium will only allow 'Save As New' to a writable compendium. Toggle read-only here or by editing the `_compendium.md` file inside each compendium folder."
- **Compendium root folder** setting (existing, unchanged)
- **Compendium list** -- each compendium shows:
  - Name and description
  - Entity count
  - Homebrew badge (if applicable)
  - Read-only toggle switch
- Toggling read-only in settings writes to the `_compendium.md` file
- Editing `_compendium.md` directly updates the settings UI on next load

## Claudian Integration

### New MCP Tool: `create_compendium`

```typescript
{
  name: "create_compendium",
  description: "Create a new compendium for organizing D&D entities",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Compendium name" },
      description: { type: "string", description: "Compendium description" },
      readonly: { type: "boolean", default: false },
      homebrew: { type: "boolean", default: true }
    },
    required: ["name"]
  }
}
```

What it does:
1. Creates folder: `{compendiumRoot}/{name}/`
2. Creates `_compendium.md` with the provided properties
3. Registers the compendium in `CompendiumManager`

Existing `generate_monster` / `generate_spell` / `generate_item` tools are unchanged -- the chat "Copy & Save" flow prompts which compendium to save into.

## Migration

No automated migration. The user will:

1. Delete the existing `SRD/` and `me/` folders under `Compendium/`
2. Reload Obsidian
3. On plugin load, the compendium discovery step checks if the SRD folder exists. If `srdImported` is true but no SRD folder is found, it resets `srdImported` to false, triggering re-import using the new format
4. All new saves going forward use the new file format

The `userEntityFolder` setting is removed from the settings tab -- entities are saved to user-chosen compendiums, not a hardcoded subfolder. The setting field remains in `ArchivistSettings` for backward compatibility but is no longer used or displayed.

## Out of Scope

- Automated migration of old-format files (user deletes and re-imports)
- Entity types without renderers (armor, weapons, feats, conditions, classes, backgrounds) -- these still get stored in the compendium with frontmatter but won't render as parchment stat blocks via `{{}}` until renderers are built
- Bulk operations (move entity between compendiums, merge compendiums)
- Compendium import/export (sharing compendiums between vaults)
