# Claudian Integration Polish -- Design Spec

## Goal

Fix 8 issues with the Claudian-based Archivist Inquiry chat: thinking flavor texts, MCP tool wiring, settings cleanup, UI visual restoration, system prompt gaps, entity generation visual flow, @ mention inline rendering, and [[ entity autocomplete.

## Scope

All changes are within the `feature/claudian-integration` branch. No new files are created without explicit user permission. Changes are layered on top of the existing Claudian fork at `src/inquiry/`.

---

## 1. Thinking Flavor System

### Problem

The 85 Claudian flavor texts ("Sipping coffee...", "Aligning chakras...") have zero owl/D&D character. An owl icon was added next to the text but the user wants themed text with per-entry icons instead.

### Design

**Replace `FLAVOR_TEXTS` in `src/inquiry/features/chat/constants.ts`** with 50 D&D-themed entries, each a `{ text: string, icon: string }` object. Icons are Lucide (built-in) or Tabler Icons (supplementary).

**Install `@tabler/icons` as a dev dependency.** Create `src/inquiry/shared/icons/tabler-icons.ts` that cherry-picks needed Tabler SVGs and registers them via Obsidian's `addIcon()` API (100x100 viewBox). Called once during `InquiryModule.init()`.

**Remove the owl icon** from the thinking indicator. Show only the themed icon + italic text in brand orange.

**Replace `COMPLETION_FLAVOR_WORDS`** (22 generic words) with ~15 D&D-themed completion words: "Crafted", "Conjured", "Forged", "Brewed", "Unearthed", "Transcribed", "Inscribed", "Deciphered", "Compiled", "Summoned", "Enchanted", "Unveiled", "Channeled", "Divined", "Scribed".

**Flavor text type:**
```typescript
interface ThinkingFlavor {
  text: string;  // e.g., "Consulting the tomes..."
  icon: string;  // Lucide/Tabler icon name, e.g., "book-open"
}
```

**50 entries organized in 5 categories** (10 each): Scholarly/Research, Arcane/Magical, Owl Persona/Wisdom, Adventure/Combat/Exploration, Mystical/Divination.

### Files

- Modify: `src/inquiry/features/chat/constants.ts` -- replace arrays
- Modify: `src/inquiry/features/chat/controllers/StreamController.ts` -- use `flavor.icon` via `setIcon()`, remove `createOwlIcon()` call
- Modify: `src/inquiry/features/chat/rendering/ThinkingBlockRenderer.ts` -- remove owl icon from thinking blocks
- Create: `src/inquiry/shared/icons/tabler-icons.ts` -- Tabler icon registration
- Modify: `src/inquiry/InquiryModule.ts` -- call Tabler registration on init
- Modify: `package.json` -- add `@tabler/icons` dev dependency

---

## 2. MCP Server Wiring Fix

### Problem

Archivist MCP tools (`mcp__archivist__generate_monster`, etc.) are invisible during normal chat. The AI cannot find them via ToolSearch and falls back to writing markdown by hand.

### Root Cause

`buildPersistentQueryOptions()` in `QueryOptionsBuilder.ts` does not include `archivistMcpServer` in the initial `options.mcpServers`. The server is supposed to be added via `setMcpServers()` in `applyDynamicUpdates()`, but:

1. The `setMcpServers` call is wrapped in a silent `catch` that swallows errors (only shows a Notice, no console log)
2. There may be a timing race between `initialize()` completing and `setMcpServers()` being called
3. Even if `setMcpServers` "succeeds", the `errors` field in `McpSetServersResult` is completely ignored

### Fix

**Primary fix:** Include the Archivist MCP server in `buildPersistentQueryOptions()` at construction time, mirroring what `buildColdStartQueryOptions()` already does. This eliminates dependence on the dynamic `setMcpServers` path for the Archivist server.

**Secondary fix:** Add proper error logging to the `catch` block in `applyDynamicUpdates()` and log `McpSetServersResult.errors` so future MCP issues are diagnosable.

### Files

- Modify: `src/inquiry/core/agent/QueryOptionsBuilder.ts` -- add `archivistMcpServer` to persistent query options
- Modify: `src/inquiry/core/agent/ClaudianService.ts` -- improve error logging in `applyDynamicUpdates()`

---

## 3. Settings Cleanup

### Changes

| Setting | Current Default | New Default | Rationale |
|---------|----------------|-------------|-----------|
| `model` | `'haiku'` | `'opus'` | Most capable model for D&D generation |
| `titleGenerationModel` | `''` (auto) | `'haiku'` | Cheap model for title generation |
| `enableOpus1M` | `false` | `true` | 1M context by default |
| `enableSonnet1M` | `false` | `true` | 1M context by default |
| `thinkingBudget` | `'off'` | REMOVED | Redundant with `effortLevel` |
| `permissionMode` type | `'yolo' \| 'plan' \| 'normal'` | `'unleashed' \| 'guarded'` | D&D themed, Plan mode removed |
| `permissionMode` default | `'yolo'` | `'unleashed'` | Same behavior, new name |

### Permission Modes

| Mode | SDK Mapping | Behavior |
|------|-------------|----------|
| `unleashed` | `bypassPermissions` | Full autonomy, no permission checks |
| `guarded` | `acceptEdits` | Auto-approves reads/edits, prompts for risky operations |

Plan mode is removed entirely:
- Remove `Shift+Tab` plan toggle from `ClaudianView.ts`
- Remove plan approval card rendering
- Remove plan-mode border state CSS (teal glow)
- Remove `prePlanPermissionMode` state tracking
- Remove `'plan'` from `PermissionMode` type

### Permission Toggle UI

The toggle shows "Unleashed" / "Guarded" labels. A `?` icon (Lucide `help-circle`, 12px) sits next to the toggle. On hover, a tooltip explains:
- **Unleashed**: "The Archivist acts freely without asking for permission"
- **Guarded**: "The Archivist asks before running commands or making risky changes"

### Files

- Modify: `src/inquiry/core/types/settings.ts` -- defaults, remove `thinkingBudget`, change `PermissionMode` type
- Modify: `src/inquiry/core/agent/QueryOptionsBuilder.ts` -- map `unleashed`/`guarded` to SDK modes, remove plan mapping
- Modify: `src/inquiry/features/chat/ClaudianView.ts` -- remove Shift+Tab plan toggle
- Modify: `src/inquiry/features/chat/ui/PermissionToggle.ts` -- rename labels, add `?` tooltip, remove plan state
- Modify: `src/inquiry/features/chat/controllers/StreamController.ts` -- remove plan mode handling
- Modify: `src/inquiry/features/chat/controllers/InputController.ts` -- remove plan mode input state
- Remove plan-related CSS from style files

---

## 4. UI Visual Restoration

### Welcome Screen (restore OLD style)

- Use the real Archivist owl icon from `src/ui/components/owl-icon.ts` (not a generic SVG)
- Owl icon: 32px, colored `var(--archivist-brand)` (#D97757)
- Greeting: "Good evening" in Libre Baskerville, 20px, font-weight 300, `var(--text-normal)`
- Subtitle: "What knowledge do you seek?" in 12px, `var(--text-muted)`
- Container: `opacity: 0.7`, padding `40px 20px`, centered

### Tabs (restore OLD style)

Replace Claudian's numbered badge pills with the old text-label tab strip:
- Horizontal scrollable row with `overflow-x: auto`
- Each tab: padding `6px 12px`, font-size `11px`, `var(--text-muted)` color
- Active tab: `color: var(--archivist-brand)`, `border-bottom: 2px solid var(--archivist-brand)`
- Streaming state: 6px pulsing dot badge in brand orange
- Done state: 6px green dot
- Close button: per-tab `x`, hidden until hover (opacity toggle)
- Right-click context menu: Close, Close Others, Close All
- Container: `border-bottom: 1px solid var(--background-modifier-border)`, `background: var(--background-secondary)`

### User Message Bubbles (keep NEW style)

No changes. Keep: `rgba(0,0,0,0.3)` background, no border, 95% max-width, `border-radius: 8px 8px 4px 8px`.

### Toolbar (restore OLD style)

- Top border: `1px solid var(--background-modifier-border-focus)`
- Separators between sections: 1px wide, 12px tall dividers
- Font size: 10px for toolbar items
- Model selector: brand-colored text always (not muted)
- Send button: 28x28px, `border-radius: 6px`, `background: var(--archivist-brand)`, white send arrow icon (14x14)
- Stop button: 28x28px, `background: var(--text-muted)`, white 10x10 square icon
- Unleashed/Guarded toggle: replaces Auto/Safe
  - Unleashed state: brand-orange background, like old "Auto" green but in brand color
  - Guarded state: neutral `var(--background-modifier-border)` background
  - `?` tooltip icon next to toggle

### Code Blocks (restore OLD style)

- Bordered wrapper: `1px solid var(--background-modifier-border)`, `border-radius: 6px`
- Header bar above code: `background: var(--background-secondary)`, padding `4px 8px`
  - Language label on left (11px, `var(--text-muted)`)
  - Copy button on right (always visible, not hover-reveal)
- Remove floating language-label-as-copy-button approach

### Textarea

- Placeholder: `"Ask the Archivist... (@ files, [[ entities, / commands)"`
- Keep existing sizing and padding

### Files

- Modify: `src/inquiry/features/chat/ui/WelcomeScreen.ts` -- restore old welcome
- Modify: `src/inquiry/features/chat/tabs/TabBar.ts` -- rewrite to old tab strip style
- Modify: `src/inquiry/features/chat/ui/PermissionToggle.ts` -- old toggle style with D&D names
- Modify: `src/inquiry/features/chat/rendering/CodeBlockRenderer.ts` -- restore header bar
- Modify: `src/inquiry/features/chat/ui/ModelSelector.ts` -- brand-colored text
- Modify: `src/styles/archivist-layout-overrides.css` -- toolbar, header, tab strip CSS
- Modify: `src/inquiry/style/components/*.css` -- various component style fixes

---

## 5. System Prompt Fix

### Problem

The D&D system prompt doesn't mention image/PDF reading capabilities. Claude only searches .md files via Grep and never uses Read on images or PDFs.

### Fix

Add to the TOOLS section of `buildDndSystemPromptSection()`:

```
- You can read images (PNG, JPG, GIF, WebP) in the vault for visual analysis using the Read tool.
- You can read PDF files using the Read tool with the pages parameter for specific page ranges.
- When searching the vault, consider all file types -- not just markdown. Use Glob to find images, PDFs, and other files, then Read to examine them.
```

### Files

- Modify: `src/inquiry/core/prompts/dndContext.ts`

---

## 6. Entity Generation Visual Flow

### Problem

No skeleton placeholder during generation. No progressive reveal. The entity block appears all at once only when the tool result arrives. User wants to see the block filling up during streaming.

### Design

**Visual sequence:**

1. **Tool call header** -- `[wand-2 icon] Generating Monster [spinner]` with entity name in summary once available
2. **Skeleton placeholder** -- parchment-colored box, sibling after tool call block:
   - Background: `#fdf1dc` (parchment), border: `1px solid #d9c484`
   - Header: "Generating Monster..." in Libre Baskerville, 16px, color `#7a200d`
   - 3 placeholder bars pulsing via `archivist-skeleton-pulse` animation (opacity 1.0 to 0.6, 1.5s)
   - Max-width: 400px
3. **Progressive filling** -- as `tool_input_delta` events stream YAML, attempt incremental parsing:
   - Try `yaml.load()` on accumulated input. If it throws (incomplete YAML), keep the last successful parse.
   - As fields become available, replace skeleton bars with actual rendered content: name first, then type/size, then AC/HP, then abilities, then features/actions.
   - Each new field fades in with a brief transition.
   - Never show YAML parse errors to the user. Failed parses are silently ignored.
4. **Final block** -- when `tool_result` arrives, replace entire skeleton with fully rendered stat block (same renderers: `renderMonsterBlock`, `renderSpellBlock`, `renderItemBlock`)
5. **Action row** -- below the rendered block:
   - Source badge: "Custom" with pen-tool icon, brand-colored on semi-transparent background
   - "Copy & Save" button: copy-plus icon + text, pill-shaped, 11px, secondary background
   - On click: copies YAML to clipboard, saves to vault, button shows "Saved!" for 2s

### Progressive Parse Strategy

```typescript
// Accumulated YAML from tool_input_delta
let accumulatedInput = '';
let lastValidParse: Record<string, unknown> | null = null;

function onToolInputDelta(delta: string) {
  accumulatedInput += delta;
  try {
    const parsed = yaml.load(accumulatedInput);
    if (parsed && typeof parsed === 'object') {
      lastValidParse = parsed as Record<string, unknown>;
      updateSkeletonWithPartialData(lastValidParse);
    }
  } catch {
    // Incomplete YAML -- silently ignore, keep skeleton as-is
  }
}
```

`updateSkeletonWithPartialData()` checks which fields exist and progressively renders them into the skeleton container, replacing placeholder bars with actual content.

### Files

- Modify: `src/inquiry/features/chat/controllers/StreamController.ts` -- add skeleton creation on D&D tool start, progressive parse on `tool_input_delta`, final render on `tool_result`
- Modify: `src/inquiry/features/chat/rendering/ToolCallRenderer.ts` -- add `renderBlockSkeleton()` and `updateSkeletonWithPartialData()` functions
- Modify: `src/inquiry/features/chat/rendering/DndEntityRenderer.ts` -- ensure `renderDndEntityBlock()` includes action row with source badge and Copy & Save
- Add skeleton CSS to `src/styles/archivist-dnd.css` -- parchment skeleton styles, pulse animation, progressive fade transitions

---

## 7. @ Mention Inline Rendering

### Problem

`@filename.md` appears as plain text in sent messages. User wants inline pill chips within message text.

### Design

After markdown rendering in `MessageRenderer.renderContent()`, post-process the HTML to find `@filename` text nodes and wrap them in inline pill chips.

**Inline chip markup:**
```html
<span class="archivist-inline-mention">
  <svg><!-- file-text icon 12px --></svg>
  <span>filename.md</span>
</span>
```

**CSS:**
```css
.archivist-inline-mention {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--background-secondary);
  font-size: 11px;
  vertical-align: baseline;
  cursor: default;
}
```

The chip flows inline with surrounding text: "read `[file icon] notes.md` and tell me..."

**Detection pattern:** Match `@` followed by a valid filename (containing at least one `.` or `/`), bounded by whitespace or punctuation. Only match filenames that were actually attached as context (cross-reference with the tab's file context state).

### Files

- Modify: `src/inquiry/features/chat/rendering/MessageRenderer.ts` -- add post-processing step after markdown render
- Add CSS to `src/styles/archivist-layout-overrides.css`

---

## 8. [[ Entity Autocomplete Fix

### Problem

Typing `[[` in the Claudian chat input does not trigger the entity autocomplete dropdown. The `EntityAutocompleteDropdown` component exists but is not wired to the input controller.

### Root Cause

The `InputController` handles `@` mentions via `MentionDropdownController` but does not listen for `[[` to trigger `EntityAutocompleteDropdown`. The component exists at `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` but its `onInput()`/`onKeyDown()` methods are never called from the input event handlers.

### Fix

Wire `EntityAutocompleteDropdown` to the input controller:

1. In `InputController`, on `input` events, after checking for `@` mention trigger, also check for `[[` trigger by calling `entityAutocomplete.onInput(textarea, cursorPosition)`
2. In `InputController`, on `keydown` events, if entity autocomplete is open, delegate to `entityAutocomplete.onKeyDown(event)` for arrow navigation and Enter/Tab selection
3. Ensure Enter key selects from the dropdown when it's open (not sending the message)
4. On selection, insert `[[type:name]]` into the textarea at the cursor position

**Type-prefix filtering must work:** `[[monster:` filters to monsters only, `[[spell:` to spells, `[[doc:` to vault files, etc.

**Dropdown results show:** Entity type icon + name + source badge (SRD/Custom/Doc).

**Restore entity autocomplete CSS** -- the old `.archivist-inquiry-entity-*` styles were removed. Add equivalent styles under `.claudian-entity-autocomplete-*` or similar.

### Files

- Modify: `src/inquiry/features/chat/controllers/InputController.ts` -- wire `[[` trigger and keyboard delegation
- Modify: `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` -- verify integration works
- Add CSS for entity autocomplete dropdown to `src/styles/archivist-layout-overrides.css`

---

## Non-Goals

- Dice system (deferred to Phase 2)
- Entity document format overhaul (deferred to Phase 2)
- `data` to `raw-data` property rename (deferred to Phase 2)
- File naming convention changes (deferred to Phase 2)
- Editor `[[` autocomplete (deferred to Phase 2)
