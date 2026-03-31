# Annotations, Dice Rolling & Editor Entity Autocomplete

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Three features building on each other: annotation rendering upgrade (B), editor `[[` entity autocomplete (C2), and 3D dice rolling (A).

---

## Problem Statement

1. **Stat block annotations render as plain text** -- `{@dice 2d6+3}`, `{@dc 15}`, `{@hit +5}` etc. show as unstyled inline text in stat blocks. The original Archivist app renders these as interactive elements with Lucide icons, dashed underlines, and click-to-roll.

2. **`[[monster:` doesn't work in the Obsidian editor** -- The `[[` entity autocomplete (with type filtering like `[[monster:`, `[[spell:`, `[[item:`) only works in the Archivist Inquiry chat input, not in the Obsidian editor.

3. **No dice rolling** -- Clicking dice annotations does nothing. The original app has full 3D physics-based dice rolling via `@3d-dice/dice-box`.

---

## Feature B: Annotation Rendering Upgrade

### Current State

- `renderTextWithInlineTags()` in `renderer-utils.ts` processes backtick tags (`` `dice:2d6+3` ``) and 5etools tags (`{@dice 2d6+3}`)
- Two render paths exist via `statBlockMode` flag:
  - **Stat block mode** (`renderStatBlockTag`): plain text spans with CSS classes, no icons, no interactivity
  - **Badge mode** (`renderInlineTag`): colored pill badges with Lucide icons (used in editor/chat)
- The 5etools-to-backtick conversion (`convert5eToolsTags`) handles ~30 tag types

### Design Decisions (approved)

- **Stat blocks**: Style A -- Original Archivist (dashed underline + Lucide icons on parchment)
- **Editor/chat**: Style 2 -- Colored text + dashed underline on rollable (subtle inline, NOT pill badges)
- **Color palette**: B -- Warm Gold / Cool Teal / Soft Red (dual-mode safe)

### Target State

**Stat blocks** (on parchment background) -- matching original Archivist:
- Dice/damage tags: dark red text (`#922610`), dashed underline, Dices Lucide icon (14px), `cursor: pointer`
- DC tags: Shield icon + "DC N" text, dark parchment color (`#191813`)
- Attack/hit tags: italic, `#7a200d`, Target/Swords icon
- Recharge tags: clickable, rolls 1d6
- All clickable tags get a hover tooltip showing formula, average, range, "Click to roll"
- All dice-type tags dispatch to the dice rolling system (Feature A) on click

**Editor/chat** (on dark/light Obsidian background) -- subtle inline with dashed underlines:
- Dice/damage tags: colored text + dashed underline + Dices icon, `cursor: pointer`
- DC tags: colored text + Shield icon, no underline
- Attack tags: colored italic text + Swords icon, no underline
- Hit tags: colored text + dashed underline + Target icon, `cursor: pointer`
- Color palette (Warm Gold / Cool Teal / Soft Red):
  - Dark mode: dice `#d4a843`, DC `#5ba3b5`, atk/hit `#d47070`
  - Light mode: dice `#9a7520`, DC `#2a7a8c`, atk/hit `#b84040`
  - Dashed underline opacity: 0.45 of the text color
- Uses `body.theme-dark` / `body.theme-light` for Obsidian theme detection

### Implementation

#### 1. Upgrade `renderStatBlockTag()` in `renderer-utils.ts`

Replace plain text spans with interactive elements:

```
renderStatBlockTag(tag) -> HTMLElement:
  - Create span.archivist-stat-tag.archivist-stat-tag-{type}
  - Add Lucide icon via setIcon() (14px)
  - Add text content span
  - For dice/damage/hit/recharge: add cursor:pointer, data-dice-notation attribute
  - Add click handler: dispatch CustomEvent('archivist-dice-roll', { notation, type })
  - Add hover tooltip (title attribute or custom tooltip element)
```

#### 2. New CSS classes

**Stat block tags** (in `archivist-dnd.css`):
```css
.archivist-stat-tag          -- inline, gap via icon margin
.archivist-stat-tag-dice     -- color: #922610, border-bottom: 1px dashed #922610, cursor: pointer
.archivist-stat-tag-damage   -- same as dice
.archivist-stat-tag-atk      -- color: #7a200d, font-style: italic
.archivist-stat-tag-hit      -- color: #7a200d, border-bottom: 1px dashed #7a200d, cursor: pointer
.archivist-stat-tag-dc       -- color: #191813
.archivist-stat-tag-recharge -- color: #922610, border-bottom: 1px dashed, cursor: pointer
.archivist-stat-tag svg      -- width: 14px, height: 14px, vertical-align: -1px
```

**Editor/chat tags** (in `archivist-dnd.css`, replacing current pill badges):
```css
/* Dark mode (body.theme-dark) */
.archivist-tag-dice     -- color: #d4a843, border-bottom: 1px dashed rgba(212,168,67,0.45), cursor: pointer
.archivist-tag-damage   -- same as dice
.archivist-tag-dc       -- color: #5ba3b5
.archivist-tag-atk      -- color: #d47070, font-style: italic
.archivist-tag-hit      -- color: #d47070, border-bottom: 1px dashed rgba(212,112,112,0.45), cursor: pointer
.archivist-tag svg      -- width: 12px, height: 12px, vertical-align: -1px

/* Light mode (body.theme-light) */
.archivist-tag-dice     -- color: #9a7520, border-bottom-color: rgba(154,117,32,0.45)
.archivist-tag-dc       -- color: #2a7a8c
.archivist-tag-atk      -- color: #b84040
.archivist-tag-hit      -- color: #b84040, border-bottom-color: rgba(184,64,64,0.45)
```

#### 3. Tooltip on hover

Simple CSS tooltip using `::after` pseudo-element or a lightweight `title` attribute:
- Dice/damage: "2d6+3 (avg 10, range 5-15) -- Click to roll"
- DC: "DC 15 -- Difficulty Class"
- Hit: "+5 to hit"

---

## Feature C2: Editor `[[` Entity Autocomplete

### Current State

- Obsidian's native `[[` only searches vault files
- The plugin's `EntityAutocompleteDropdown` works in the chat input only
- SRD entities (monsters, spells, items) are not searchable from the editor

### Target State

Typing `[[monster:` in the Obsidian editor shows a filtered dropdown of SRD monsters. Same for `[[spell:`, `[[item:`. Plain `[[` without a type prefix falls through to Obsidian's native file autocomplete.

### Implementation

#### 1. `EntityEditorSuggest` class extending Obsidian's `EditorSuggest`

```
class EntityEditorSuggest extends EditorSuggest<SrdEntity>:
  - onTrigger(cursor, editor): 
    - Look back from cursor for `[[`
    - Extract query after `[[`
    - Check for type prefix (monster:, spell:, item:)
    - If type prefix found, return trigger context
    - If no prefix, return null (let Obsidian handle it)
  
  - getSuggestions(context):
    - Parse prefix and search query
    - Map "item" -> "magic-item" for SRD store
    - Call srdStore.search(query, entityType, 20)
    - Return results
  
  - renderSuggestion(entity, el):
    - Show Lucide icon (sword for monster, sparkles for spell, scroll for item)
    - Show entity name + type badge
  
  - selectSuggestion(entity):
    - Insert `[[entity.name]]` into editor
    - This becomes a normal Obsidian wiki-link to a note
    - If the note doesn't exist, Obsidian shows it as unresolved (standard behavior)
```

#### 2. Registration in `main.ts`

```typescript
this.registerEditorSuggest(new EntityEditorSuggest(this.app, this.srdStore));
```

#### 3. Entity type detection

Reuse the same prefix set from `EntityAutocompleteDropdown`:
- `monster:` -> searches SRD monsters
- `spell:` -> searches SRD spells  
- `item:` -> searches SRD magic items (mapped to `magic-item`)
- `feat:` -> searches SRD feats
- No prefix with `:` -> falls through to Obsidian native

#### 4. Dice pattern support

Following the original app, `[[2d6+3]]` in the editor could be detected and rendered as a clickable dice element. This can be a CM6 decoration plugin that:
- Matches `[[XdY+Z]]` patterns in the document
- Replaces them with inline dice widgets
- Clicking triggers the dice rolling system

This is optional for the initial implementation and can be added after Feature A.

---

## Feature A: 3D Dice Rolling

### Architecture (matching original Archivist)

Four layers:

#### Layer 1: SimpleDiceBox singleton (`src/dice/SimpleDiceBox.ts`)

Wraps `@3d-dice/dice-box` as a singleton:
- `initialize(containerId)` -- creates the BabylonJS canvas
- `roll(notation)` -- triggers a 3D dice roll
- `onRollComplete(callback)` -- fires when dice settle
- Config: gravity 3, mass 2.5, friction 0.8, restitution 0.2, scale 6
- Asset path: bundled from `@3d-dice/dice-box/src/assets` into plugin's public folder

#### Layer 2: DiceOverlay (`src/dice/DiceOverlay.ts`)

Obsidian-native overlay (not React):
- Creates a full-viewport fixed div (z-index 10000) with transparent background
- Contains the dice-box canvas container
- Shows/hides on roll start/complete
- Displays result after dice settle: notation, individual rolls, total
- Stacks multiple results if rapid rolling
- Auto-hides after 2.5s settle timeout
- Click-outside or Escape to dismiss

#### Layer 3: DiceRoller utility (`src/dice/diceRoller.ts`)

Pure math fallback (no 3D):
- `rollDice(notation)` -- parses XdY+Z and returns random results
- `rollD20(modifier)` -- d20 + modifier
- `calculateAverage(notation)` -- for tooltips
- `calculateRange(notation)` -- min/max for tooltips

#### Layer 4: Global dice API (`src/dice/index.ts`)

Single entry point:
- `rollDice3D(notation, type?)` -- tries 3D overlay first, falls back to math
- `getDiceStats(notation)` -- returns avg/min/max for tooltips
- Initialized once in plugin's `onload()`

### Asset Bundling

`@3d-dice/dice-box` requires static assets (WASM, textures, worker scripts). Options:
- **A) Bundle into plugin dist** -- copy assets during build to a known path
- **B) CDN** -- load from unpkg.com at runtime (requires internet)
- **C) Lazy download** -- download assets on first use and cache in plugin data folder

Recommend **A** for reliability (offline-first, like Obsidian's philosophy).

### Integration Points

1. **Stat block tags** -- `renderStatBlockTag()` click handlers dispatch `CustomEvent('archivist-dice-roll')`, caught by the overlay manager
2. **Chat pill badges** -- `renderInlineTag()` click handlers do the same
3. **Editor dice links** -- `[[2d6+3]]` widgets trigger rolling on click
4. **Future: combat mode** -- toggle in stat blocks that makes all dice interactive

### Dependencies

```
@3d-dice/dice-box: ^1.1.4
```

Build script needs to copy dice-box assets to the plugin's output directory.

---

## File Plan

### New Files
| File | Purpose |
|------|---------|
| `src/dice/SimpleDiceBox.ts` | @3d-dice/dice-box singleton wrapper |
| `src/dice/DiceOverlay.ts` | Full-viewport overlay for 3D dice canvas + results |
| `src/dice/diceRoller.ts` | Pure math dice roller (fallback) |
| `src/dice/index.ts` | Global API: rollDice3D(), getDiceStats() |
| `src/extensions/entity-editor-suggest.ts` | EditorSuggest for [[monster: etc. in editor |

### Modified Files
| File | Change |
|------|--------|
| `src/renderers/renderer-utils.ts` | Upgrade `renderStatBlockTag()` with icons, interactivity, click handlers |
| `src/styles/archivist-dnd.css` | Add `.archivist-stat-tag-*` styles for interactive stat block tags |
| `src/main.ts` | Register `EntityEditorSuggest`, initialize dice system |
| `package.json` | Add `@3d-dice/dice-box` dependency |
| `scripts/build-css.mjs` or build config | Copy dice-box assets to output |

### Already Fixed
| File | Change |
|------|--------|
| `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` | Map `"item"` -> `"magic-item"` in prefix search (C1, done) |

---

## Implementation Order

1. **C2: Editor `[[` autocomplete** -- `EntityEditorSuggest` class, register in main.ts
2. **B: Annotation rendering** -- Upgrade `renderStatBlockTag()`, add CSS, add icons + data attributes
3. **A1: Math dice roller** -- `diceRoller.ts` + `getDiceStats()` for tooltips
4. **A2: Dice overlay** -- `DiceOverlay.ts`, global API, wire click handlers
5. **A3: 3D dice** -- `SimpleDiceBox.ts`, asset bundling, integrate with overlay

---

## Resolved Questions

1. **Sound effects** -- No. Skip for now.
2. **Critical effects** -- No. Skip for now.
3. **Combat mode toggle** -- No toggle needed. Dice are always interactive in stat blocks by default.
