# Claudian Integration Polish -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 issues with the Claudian-based Archivist Inquiry chat: thinking flavors, MCP wiring, settings, UI restoration, system prompt, entity generation flow, @ mention rendering, and [[ autocomplete.

**Architecture:** Each task modifies a focused set of files. Tasks are ordered so that foundational changes (icons, settings types) come first, then UI/rendering changes build on them. The entity generation flow (Task 10) is the most complex, combining skeleton rendering with progressive YAML parsing.

**Tech Stack:** TypeScript, Obsidian API (`setIcon`, `addIcon`, `MarkdownRenderer`), Lucide icons (built-in), Tabler Icons (supplementary), js-yaml, CSS.

---

## File Structure

### Files to modify:
- `package.json` -- add `@tabler/icons` dev dependency
- `src/inquiry/features/chat/constants.ts` -- replace flavor text arrays
- `src/inquiry/features/chat/controllers/StreamController.ts` -- thinking indicator icons, skeleton creation, progressive parse
- `src/inquiry/features/chat/rendering/ThinkingBlockRenderer.ts` -- remove owl icon
- `src/inquiry/features/chat/rendering/ToolCallRenderer.ts` -- add skeleton rendering, progressive update
- `src/inquiry/features/chat/rendering/DndEntityRenderer.ts` -- ensure action row in all paths
- `src/inquiry/features/chat/rendering/MessageRenderer.ts` -- welcome screen, code blocks, @ mention post-processing
- `src/inquiry/core/types/settings.ts` -- defaults, types
- `src/inquiry/core/agent/QueryOptionsBuilder.ts` -- MCP wiring, permission mapping
- `src/inquiry/core/agent/ClaudianService.ts` -- MCP error logging
- `src/inquiry/features/chat/ClaudianView.ts` -- remove plan toggle
- `src/inquiry/features/chat/ui/InputToolbar.ts` -- PermissionToggle, ModelSelector, toolbar separators
- `src/inquiry/features/chat/tabs/TabBar.ts` -- rewrite to text-label strip
- `src/inquiry/features/chat/tabs/Tab.ts` -- wire EntityAutocompleteDropdown
- `src/inquiry/features/chat/tabs/types.ts` -- add entityAutocomplete to TabUIComponents
- `src/inquiry/core/prompts/dndContext.ts` -- system prompt additions
- `src/styles/archivist-dnd.css` -- skeleton styles, entity autocomplete styles
- `src/styles/archivist-layout-overrides.css` -- toolbar, welcome, tabs, code blocks, @ mention chips
- `src/inquiry/style/components/tabs.css` -- replace badge styles with tab strip
- `src/inquiry/style/components/code.css` -- header bar style
- `src/inquiry/style/components/messages.css` -- welcome style overrides
- `src/inquiry/style/toolbar/permission-toggle.css` -- Unleashed/Guarded styles
- `src/inquiry/style/toolbar/model-selector.css` -- brand color always
- `src/inquiry/style/features/plan-mode.css` -- delete or empty

### Files to create:
- `src/inquiry/shared/icons/tabler-icons.ts` -- Tabler icon registration

---

### Task 1: Install Tabler Icons and Create Registration Utility

**Files:**
- Modify: `package.json`
- Create: `src/inquiry/shared/icons/tabler-icons.ts`
- Modify: `src/inquiry/InquiryModule.ts`

- [ ] **Step 1: Install @tabler/icons**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm install --save-dev @tabler/icons
```

- [ ] **Step 2: Create the Tabler icon registration file**

Create `src/inquiry/shared/icons/tabler-icons.ts`:

```typescript
import { addIcon } from 'obsidian';

// Cherry-picked Tabler Icons for D&D thinking flavors.
// Each SVG is from @tabler/icons, converted to Obsidian's 100x100 viewBox.
// Original Tabler icons use viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none".
// We scale paths by 100/24 = 4.1667x for the 100x100 viewBox.
// Simpler approach: use the 24x24 SVG content directly inside a 0 0 24 24 viewBox
// since Obsidian's addIcon actually accepts any viewBox content as the inner SVG.

const TABLER_ICONS: Record<string, string> = {
  'tabler-wand': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 21l15 -15a2.828 2.828 0 1 0 -4 -4l-15 15v4h4z" /><path d="M15 6l4 4" /><path d="M9 3a3 3 0 0 0 3 3" /><path d="M3 9a3 3 0 0 1 3 -3" />',
  'tabler-flask': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 3l0 6" /><path d="M15 3l0 6" /><path d="M9 9a5 5 0 0 0 -4 8l1 3h12l1 -3a5 5 0 0 0 -4 -8" /><path d="M9 3h6" />',
  'tabler-scroll': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 17v-12a2 2 0 0 0 -2 -2h-11a2 2 0 0 0 -2 2v12l3 -2l2 2l2 -2l2 2l2 -2z" /><path d="M14 3v4a1 1 0 0 0 1 1h4" />',
  'tabler-crystal-ball': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="11" r="7" /><path d="M7 18h10" /><path d="M8 21h8" /><path d="M9 15a3 3 0 0 0 3 -3" />',
  'tabler-feather': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l10 -10" /><path d="M15 4l-6 6a4 4 0 0 0 6 6l6 -6a4 4 0 0 0 -6 -6" /><path d="M15 10l-3 3" />',
  'tabler-sword': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 4v5l-9 7l-4 4l-3 -3l4 -4l7 -9z" /><path d="M6.5 11.5l6 6" />',
  'tabler-campfire': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4c.68 .64 1 1.51 1 2.5c0 2 -1.5 3.5 -3 3.5s-1.5 -1.5 0 -3c-2 1 -3 3.34 -3 5.5a5 5 0 0 0 10 0c0 -2.16 -1 -4.5 -3 -5.5c1.5 1.5 0 3 0 3s-1.5 -1.5 -1.5 -3.5c0 -1 .32 -1.86 1 -2.5z" /><path d="M4 21h16" />',
  'tabler-chess-knight': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v.382h12v-.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8z" /><path d="M9 3s1 2 1 4c-2 0 -3 1 -3.5 2.5l-.5 2.5h10l-1 -4c0 -2 -1 -3 -3 -3l-2 -2z" /><circle cx="13" cy="9" r="1" />',
  'tabler-door': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 12v.01" /><path d="M3 21h18" /><path d="M6 21v-16a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16" />',
  'tabler-old-key': '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 9h-1a2 2 0 0 0 -2 2v0a2 2 0 0 0 2 2h1" /><path d="M11 12h-7l-1 1v2h3v-1h1v1h1" /><circle cx="17" cy="11" r="4" />',
};

let registered = false;

export function registerTablerIcons(): void {
  if (registered) return;
  for (const [name, svg] of Object.entries(TABLER_ICONS)) {
    addIcon(name, svg);
  }
  registered = true;
}
```

- [ ] **Step 3: Call registration in InquiryModule.init()**

In `src/inquiry/InquiryModule.ts`, add the import and call near the top of `init()`:

Add import at the top of the file:
```typescript
import { registerTablerIcons } from './shared/icons/tabler-icons';
```

Add call at the beginning of the `init()` method (after the first few lines of setup):
```typescript
registerTablerIcons();
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/inquiry/shared/icons/tabler-icons.ts src/inquiry/InquiryModule.ts
git commit -m "feat: add Tabler Icons registration for D&D thinking flavors"
```

---

### Task 2: Replace Thinking Flavor Texts and Completion Words

**Files:**
- Modify: `src/inquiry/features/chat/constants.ts`

- [ ] **Step 1: Replace FLAVOR_TEXTS and COMPLETION_FLAVOR_WORDS**

In `src/inquiry/features/chat/constants.ts`, replace the `COMPLETION_FLAVOR_WORDS` array (lines 10-33) and `FLAVOR_TEXTS` array (lines 36-122) with:

```typescript
export interface ThinkingFlavor {
  text: string;
  icon: string;
}

export const COMPLETION_FLAVOR_WORDS = [
  'Crafted', 'Conjured', 'Forged', 'Brewed', 'Unearthed',
  'Transcribed', 'Inscribed', 'Deciphered', 'Compiled',
  'Summoned', 'Enchanted', 'Unveiled', 'Channeled', 'Divined', 'Scribed',
];

export const FLAVOR_TEXTS: ThinkingFlavor[] = [
  // Scholarly / Research
  { text: 'Consulting the tomes...', icon: 'book-open' },
  { text: 'Marking a page in the grimoire...', icon: 'bookmark' },
  { text: 'Leafing through scrolls...', icon: 'scroll-text' },
  { text: 'Searching the archives...', icon: 'search' },
  { text: 'Cross-referencing the codex...', icon: 'book-open' },
  { text: 'Indexing the library...', icon: 'library' },
  { text: 'Cataloguing the findings...', icon: 'box' },
  { text: 'Annotating the manuscript...', icon: 'pen-tool' },
  { text: 'Transcribing ancient text...', icon: 'feather' },
  { text: 'Checking the ledger...', icon: 'table' },

  // Arcane / Magical
  { text: 'Channeling the arcane...', icon: 'wand-2' },
  { text: 'Conjuring a response...', icon: 'sparkles' },
  { text: 'Scrying for answers...', icon: 'eye' },
  { text: 'Reading the runes...', icon: 'moon' },
  { text: 'Invoking eldritch knowledge...', icon: 'zap' },
  { text: 'Brewing a spell...', icon: 'flame' },
  { text: 'Weaving an incantation...', icon: 'star' },
  { text: 'Peering into the astral plane...', icon: 'globe' },
  { text: 'Preparing a ward...', icon: 'shield-check' },
  { text: 'Attuning to the Weave...', icon: 'sparkles' },

  // Owl Persona / Wisdom
  { text: 'Pondering deeply...', icon: 'brain' },
  { text: 'Hooting thoughtfully...', icon: 'tabler-feather' },
  { text: 'Mulling this over...', icon: 'info' },
  { text: 'Roosting on this thought...', icon: 'cloud' },
  { text: 'Retreating to the study...', icon: 'tabler-door' },
  { text: 'Connecting the threads...', icon: 'git-branch' },
  { text: 'Taking a wise pause...', icon: 'clock' },
  { text: 'Sifting through lore...', icon: 'layers' },
  { text: 'Perching among the shelves...', icon: 'landmark' },
  { text: 'Gazing with keen owl eyes...', icon: 'eye' },

  // Adventure / Combat / Exploration
  { text: 'Charting the course...', icon: 'map' },
  { text: 'Navigating the unknown...', icon: 'compass' },
  { text: 'Scouting ahead...', icon: 'binoculars' },
  { text: 'Rallying the party...', icon: 'megaphone' },
  { text: 'Reviewing the quest log...', icon: 'file-text' },
  { text: 'Rolling for initiative...', icon: 'dices' },
  { text: 'Fortifying defenses...', icon: 'shield' },
  { text: 'Sharpening the quill...', icon: 'swords' },
  { text: 'Unfurling a map...', icon: 'scroll-text' },
  { text: 'Consulting the war table...', icon: 'layout-grid' },

  // Mystical / Divination / Dark
  { text: 'Consulting the moon...', icon: 'moon' },
  { text: 'Summoning dawn light...', icon: 'sun' },
  { text: 'Communing with spirits...', icon: 'ghost' },
  { text: 'Whispering to the void...', icon: 'skull' },
  { text: 'Gathering the winds...', icon: 'wind' },
  { text: 'Unfolding the prophecy...', icon: 'tabler-scroll' },
  { text: 'Consulting the celestial calendar...', icon: 'hourglass' },
  { text: 'Casting detect magic...', icon: 'tabler-wand' },
  { text: 'Summoning a familiar...', icon: 'tabler-campfire' },
  { text: 'Unlocking forbidden knowledge...', icon: 'lock' },
];
```

Keep the `LOGO_SVG` constant (lines 1-8) unchanged.

- [ ] **Step 2: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Expected: Build succeeds. If there are type errors because other files reference `FLAVOR_TEXTS` as `string[]`, those will be fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/features/chat/constants.ts
git commit -m "feat: replace generic flavor texts with 50 D&D-themed entries"
```

---

### Task 3: Update StreamController Thinking Indicator to Use Flavor Icons

**Files:**
- Modify: `src/inquiry/features/chat/controllers/StreamController.ts`
- Modify: `src/inquiry/features/chat/rendering/ThinkingBlockRenderer.ts`

- [ ] **Step 1: Update showThinkingIndicator in StreamController.ts**

In `src/inquiry/features/chat/controllers/StreamController.ts`, find the `showThinkingIndicator()` method (around line 899). The current code picks a random string from `FLAVOR_TEXTS` and renders it with `createOwlIcon(14)`.

Change the import at the top of the file. Find:
```typescript
import { FLAVOR_TEXTS, COMPLETION_FLAVOR_WORDS } from '../constants';
```
Ensure it stays the same (the import name doesn't change, just the type changes).

Also find and remove the import of `createOwlIcon` if it's only used in this method. Search for `createOwlIcon` usage -- if it's used elsewhere in the file keep the import.

In `showThinkingIndicator()`, replace the flavor text selection and rendering. Find the section that creates the indicator element (around line 920-940). Replace the part that does:
```typescript
const owlIcon = createOwlIcon(14);
thinkingEl.appendChild(owlIcon);
```

With:
```typescript
const iconEl = thinkingEl.createSpan({ cls: 'claudian-thinking-icon' });
setIcon(iconEl, flavor.icon);
```

And change the flavor selection from:
```typescript
const flavor = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];
```
to (keep the same line, but now `flavor` is an object):
```typescript
const flavor = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];
```

Then change where the text is set. Find where it sets the text content (something like `textEl.setText(flavor)` or `textEl.textContent = flavor`). Change to:
```typescript
textEl.setText(flavor.text);
```

Make sure to add `import { setIcon } from 'obsidian';` at the top if not already imported.

- [ ] **Step 2: Remove owl icon from ThinkingBlockRenderer.ts**

In `src/inquiry/features/chat/rendering/ThinkingBlockRenderer.ts`, find `createThinkingBlock()` (around line 16). It creates an owl icon via `createOwlIcon(14)` and inserts it into the thinking header. Remove the owl icon creation and insertion. The thinking block header should only show the label text (e.g., "Thinking 0s...").

Also in `renderStoredThinkingBlock()` (around line 100), remove the owl icon if present.

Remove the `createOwlIcon` import if no longer used in this file.

- [ ] **Step 3: Add CSS for thinking icon**

In `src/inquiry/style/components/thinking.css`, add after line 10 (after the `.claudian-thinking` block):

```css
.claudian-thinking-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.claudian-thinking-icon svg {
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/inquiry/features/chat/controllers/StreamController.ts src/inquiry/features/chat/rendering/ThinkingBlockRenderer.ts src/inquiry/style/components/thinking.css
git commit -m "feat: use per-flavor D&D icons in thinking indicator, remove owl icon"
```

---

### Task 4: Fix MCP Server Wiring for Persistent Queries

**Files:**
- Modify: `src/inquiry/core/agent/QueryOptionsBuilder.ts`
- Modify: `src/inquiry/core/agent/ClaudianService.ts`

- [ ] **Step 1: Add archivistMcpServer to buildPersistentQueryOptions**

In `src/inquiry/core/agent/QueryOptionsBuilder.ts`, find `buildPersistentQueryOptions()` (around line 190). Currently it does NOT set `options.mcpServers`. Add the Archivist MCP server to the options just like `buildColdStartQueryOptions` does.

Find the `return options;` at the end of `buildPersistentQueryOptions()` (around line 250). Before it, add:

```typescript
    // Include Archivist MCP server in persistent query options
    if (ctx.archivistMcpServer) {
      options.mcpServers = options.mcpServers || {};
      options.mcpServers['archivist'] = ctx.archivistMcpServer;
    }
```

- [ ] **Step 2: Improve error logging in ClaudianService applyDynamicUpdates**

In `src/inquiry/core/agent/ClaudianService.ts`, find the `setMcpServers` call inside `applyDynamicUpdates()` (around line 1230). The current catch block is:

```typescript
} catch {
    new Notice('Failed to update MCP servers');
}
```

Replace with:

```typescript
} catch (e) {
    console.error('[ClaudianService] setMcpServers failed:', e);
    new Notice('Failed to update MCP servers');
}
```

Also, after the `setMcpServers` call succeeds, log any errors from the result. Find where `await this.persistentQuery.setMcpServers(serverConfigs)` is called and change to:

```typescript
const mcpResult = await this.persistentQuery.setMcpServers(serverConfigs);
if (mcpResult?.errors && Object.keys(mcpResult.errors).length > 0) {
  console.warn('[ClaudianService] MCP server errors:', JSON.stringify(mcpResult.errors));
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/inquiry/core/agent/QueryOptionsBuilder.ts src/inquiry/core/agent/ClaudianService.ts
git commit -m "fix: wire Archivist MCP server into persistent query options"
```

---

### Task 5: Settings Defaults and Permission Mode Type Changes

**Files:**
- Modify: `src/inquiry/core/types/settings.ts`

- [ ] **Step 1: Change PermissionMode type and defaults**

In `src/inquiry/core/types/settings.ts`:

Find the `PermissionMode` type (line 121):
```typescript
export type PermissionMode = 'yolo' | 'plan' | 'normal';
```
Replace with:
```typescript
export type PermissionMode = 'unleashed' | 'guarded';
```

Find `thinkingBudget` in the `ClaudianSettings` interface and remove it. Also remove the `ThinkingBudget` type if it exists.

In `DEFAULT_SETTINGS` (around line 305), change:
```typescript
model: 'haiku',
```
to:
```typescript
model: 'opus',
```

Change:
```typescript
permissionMode: 'yolo' as PermissionMode,
```
to:
```typescript
permissionMode: 'unleashed' as PermissionMode,
```

Change:
```typescript
enableOpus1M: false,
enableSonnet1M: false,
```
to:
```typescript
enableOpus1M: true,
enableSonnet1M: true,
```

Find `titleGenerationModel` default (should be `''`) and change to:
```typescript
titleGenerationModel: 'haiku',
```

Remove `thinkingBudget` from DEFAULT_SETTINGS.

- [ ] **Step 2: Fix all type errors from PermissionMode change**

Search the entire codebase for references to `'yolo'`, `'plan'`, `'normal'` as PermissionMode values. Each needs updating:

In `QueryOptionsBuilder.ts` `applyPermissionMode()` (around line 335), change the switch:
```typescript
switch (mode) {
  case 'unleashed':
    options.permissionMode = 'bypassPermissions';
    break;
  case 'guarded':
    options.permissionMode = 'acceptEdits';
    break;
  default:
    options.permissionMode = 'acceptEdits';
}
```

In `InquiryModule.ts` `loadSettings()`, find where it normalizes plan mode to normal (something like `if (settings.permissionMode === 'plan') settings.permissionMode = 'normal'`). Change to migrate old values:
```typescript
// Migrate old permission mode values
const pm = settings.permissionMode as string;
if (pm === 'yolo' || pm === 'plan' || pm === 'normal') {
  settings.permissionMode = (pm === 'normal' || pm === 'plan') ? 'guarded' : 'unleashed';
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Fix any remaining type errors by searching for `'yolo'`, `'plan'`, `'normal'` in `.ts` files and replacing with `'unleashed'` or `'guarded'` as appropriate.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: change settings defaults and rename permission modes to Unleashed/Guarded"
```

---

### Task 6: Remove Plan Mode UI and Update Permission Toggle

**Files:**
- Modify: `src/inquiry/features/chat/ClaudianView.ts`
- Modify: `src/inquiry/features/chat/ui/InputToolbar.ts` (PermissionToggle class)
- Modify: `src/inquiry/features/chat/controllers/InputController.ts`
- Modify: `src/inquiry/style/toolbar/permission-toggle.css`
- Modify: `src/inquiry/style/features/plan-mode.css`

- [ ] **Step 1: Remove Shift+Tab plan toggle from ClaudianView.ts**

In `src/inquiry/features/chat/ClaudianView.ts`, find the Shift+Tab handler (around lines 475-490). Remove the entire plan mode toggle block. It should look something like:

```typescript
if (e.key === 'Tab' && e.shiftKey) {
  e.preventDefault();
  // ... plan mode toggle logic ...
}
```

Remove this entire `if` block. Also remove any `updatePlanModeUI` method and `prePlanPermissionMode` references.

- [ ] **Step 2: Update PermissionToggle in InputToolbar.ts**

In `src/inquiry/features/chat/ui/InputToolbar.ts`, find the `PermissionToggle` class (around lines 238-289). Replace the entire class:

```typescript
export class PermissionToggle {
  private container: HTMLElement;
  private toggleEl: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;
  private helpEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'claudian-permission-toggle' });
    this.render();
  }

  private render() {
    this.container.empty();
    this.labelEl = this.container.createSpan({ cls: 'claudian-permission-label' });
    this.toggleEl = this.container.createDiv({ cls: 'claudian-toggle-switch' });

    this.helpEl = this.container.createSpan({ cls: 'claudian-permission-help' });
    setIcon(this.helpEl, 'help-circle');

    this.updateDisplay();
    this.toggleEl.addEventListener('click', () => this.toggle());
  }

  updateDisplay() {
    if (!this.toggleEl || !this.labelEl || !this.helpEl) return;
    const mode = this.callbacks.getSettings().permissionMode;
    if (mode === 'unleashed') {
      this.toggleEl.addClass('active');
      this.labelEl.setText('Unleashed');
      this.helpEl.setAttribute('aria-label', 'The Archivist acts freely without asking for permission');
    } else {
      this.toggleEl.removeClass('active');
      this.labelEl.setText('Guarded');
      this.helpEl.setAttribute('aria-label', 'The Archivist asks before running commands or making risky changes');
    }
  }

  private async toggle() {
    const current = this.callbacks.getSettings().permissionMode;
    const newMode: PermissionMode = current === 'unleashed' ? 'guarded' : 'unleashed';
    await this.callbacks.onPermissionModeChange(newMode);
    this.updateDisplay();
  }
}
```

Make sure `setIcon` is imported from `'obsidian'` and `PermissionMode` is imported from the types file.

- [ ] **Step 3: Remove plan mode from InputController.ts**

In `src/inquiry/features/chat/controllers/InputController.ts`, find and remove the `handleExitPlanMode()` method (around lines 873-915). Also search for any references to `'plan'` mode and remove them.

- [ ] **Step 4: Update permission toggle CSS**

In `src/inquiry/style/toolbar/permission-toggle.css`, replace the `.plan-active` rule with help icon styles:

Remove:
```css
.claudian-permission-label.plan-active {
  color: rgb(92, 148, 140);
  font-weight: 600;
}
```

Add:
```css
.claudian-permission-help {
  display: flex;
  align-items: center;
  cursor: help;
  color: var(--text-faint);
  margin-left: 2px;
}

.claudian-permission-help svg {
  width: 12px;
  height: 12px;
}

.claudian-permission-help:hover {
  color: var(--text-muted);
}
```

- [ ] **Step 5: Empty plan-mode.css**

Replace the content of `src/inquiry/style/features/plan-mode.css` with:

```css
/* Plan mode removed -- Archivist uses Unleashed/Guarded modes only */
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/inquiry/features/chat/ClaudianView.ts src/inquiry/features/chat/ui/InputToolbar.ts src/inquiry/features/chat/controllers/InputController.ts src/inquiry/style/toolbar/permission-toggle.css src/inquiry/style/features/plan-mode.css
git commit -m "feat: remove plan mode, rename permission toggle to Unleashed/Guarded with help tooltip"
```

---

### Task 7: Restore Welcome Screen to Old Style

**Files:**
- Modify: `src/inquiry/features/chat/rendering/MessageRenderer.ts`
- Modify: `src/inquiry/style/components/messages.css`

- [ ] **Step 1: Update welcome rendering in MessageRenderer.ts**

In `src/inquiry/features/chat/rendering/MessageRenderer.ts`, find `renderMessages()` (around line 131). The current code creates a welcome with `createOwlIcon(32)` and a greeting. Update to add the subtitle:

Find:
```typescript
const newWelcomeEl = this.messagesEl.createDiv({ cls: 'claudian-welcome' });
newWelcomeEl.createDiv({ cls: 'claudian-welcome-greeting', text: getGreeting() });
newWelcomeEl.insertBefore(createOwlIcon(32), newWelcomeEl.firstChild);
```

Replace with:
```typescript
const newWelcomeEl = this.messagesEl.createDiv({ cls: 'claudian-welcome' });
newWelcomeEl.appendChild(createOwlIcon(32));
newWelcomeEl.createDiv({ cls: 'claudian-welcome-greeting', text: getGreeting() });
newWelcomeEl.createDiv({ cls: 'claudian-welcome-subtitle', text: 'What knowledge do you seek?' });
```

- [ ] **Step 2: Update welcome CSS**

In `src/inquiry/style/components/messages.css`, replace the welcome styles (lines 25-45) with:

```css
/* Welcome message - Archivist owl style */
.claudian-welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  min-height: 200px;
  opacity: 0.7;
}

.claudian-welcome svg {
  color: var(--claudian-brand);
  margin-bottom: 12px;
}

.claudian-welcome-greeting {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 20px;
  font-weight: 300;
  color: var(--text-normal);
}

.claudian-welcome-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/inquiry/features/chat/rendering/MessageRenderer.ts src/inquiry/style/components/messages.css
git commit -m "feat: restore old-style welcome screen with owl icon, Libre Baskerville, and subtitle"
```

---

### Task 8: Restore Text-Label Tab Strip

**Files:**
- Modify: `src/inquiry/features/chat/tabs/TabBar.ts`
- Modify: `src/inquiry/style/components/tabs.css`

- [ ] **Step 1: Rewrite TabBar.ts to text-label strip**

In `src/inquiry/features/chat/tabs/TabBar.ts`, the current implementation renders numbered badge pills. Replace the entire file content with a text-label tab strip:

```typescript
import { setIcon } from 'obsidian';

export interface TabBarEntry {
  id: string;
  title: string;
  state: 'active' | 'streaming' | 'attention' | 'idle';
  canClose: boolean;
}

export interface TabBarCallbacks {
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
}

export class TabBar {
  private containerEl: HTMLElement;
  private callbacks: TabBarCallbacks;
  private entries: TabBarEntry[] = [];

  constructor(containerEl: HTMLElement, callbacks: TabBarCallbacks) {
    this.containerEl = containerEl;
    this.containerEl.addClass('archivist-tab-bar');
  this.callbacks = callbacks;
  }

  update(entries: TabBarEntry[]): void {
    this.entries = entries;
    this.render();
  }

  private render(): void {
    this.containerEl.empty();

    for (const entry of this.entries) {
      const tab = this.containerEl.createDiv({
        cls: `archivist-tab ${entry.state === 'active' ? 'archivist-tab-active' : ''}`,
      });
      tab.setAttribute('data-tab-id', entry.id);

      // Title
      const titleEl = tab.createSpan({ cls: 'archivist-tab-title', text: entry.title || 'New' });

      // State badge
      if (entry.state === 'streaming') {
        tab.createSpan({ cls: 'archivist-tab-dot archivist-tab-dot-streaming' });
      } else if (entry.state === 'attention') {
        tab.createSpan({ cls: 'archivist-tab-dot archivist-tab-dot-attention' });
      }

      // Close button (hidden until hover)
      if (entry.canClose) {
        const closeBtn = tab.createSpan({ cls: 'archivist-tab-close' });
        setIcon(closeBtn, 'x');
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.callbacks.onCloseTab(entry.id);
        });
      }

      // Click to switch
      tab.addEventListener('click', () => {
        this.callbacks.onSwitchTab(entry.id);
      });

      // Right-click context menu
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, entry);
      });
    }
  }

  private showContextMenu(e: MouseEvent, entry: TabBarEntry): void {
    const menu = document.createElement('div');
    menu.addClass('archivist-tab-context-menu');
    menu.style.position = 'fixed';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const addItem = (label: string, action: () => void) => {
      const item = menu.createDiv({ cls: 'archivist-tab-context-item', text: label });
      item.addEventListener('click', () => {
        menu.remove();
        action();
      });
    };

    if (entry.canClose) {
      addItem('Close', () => this.callbacks.onCloseTab(entry.id));
    }
    if (this.callbacks.onCloseOtherTabs) {
      addItem('Close Others', () => this.callbacks.onCloseOtherTabs!(entry.id));
    }
    if (this.callbacks.onCloseAllTabs) {
      addItem('Close All', () => this.callbacks.onCloseAllTabs!());
    }

    document.body.appendChild(menu);

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('click', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }
}
```

- [ ] **Step 2: Replace tab CSS**

In `src/inquiry/style/components/tabs.css`, replace entire content:

```css
/* Tab strip - text labels with bottom border active indicator */
.archivist-tab-bar {
  display: flex;
  gap: 1px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  flex-shrink: 0;
}

.archivist-tab-bar::-webkit-scrollbar { display: none; }

.archivist-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  position: relative;
  transition: color 0.15s, border-color 0.15s;
}

.archivist-tab:hover {
  color: var(--text-normal);
}

.archivist-tab-active {
  color: var(--claudian-brand);
  border-bottom-color: var(--claudian-brand);
}

.archivist-tab-title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* State dots */
.archivist-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.archivist-tab-dot-streaming {
  background: var(--claudian-brand);
  animation: thinking-pulse 1.5s ease-in-out infinite;
}

.archivist-tab-dot-attention {
  background: var(--text-error);
}

/* Close button */
.archivist-tab-close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  color: var(--text-faint);
  cursor: pointer;
}

.archivist-tab-close svg { width: 10px; height: 10px; }

.archivist-tab:hover .archivist-tab-close { display: flex; }

.archivist-tab-close:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

/* Context menu */
.archivist-tab-context-menu {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 120px;
  padding: 4px;
}

.archivist-tab-context-item {
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}

.archivist-tab-context-item:hover {
  background: var(--background-modifier-hover);
}

/* Keep tab content container from old CSS */
.claudian-tab-content-container { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.claudian-tab-content { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Note: There may be type errors if `TabManager` expects a different interface from `TabBar`. The implementer should check `TabManager.ts` for how it calls `TabBar` and adjust the interface to match. The key methods are `update(entries)` with the same `TabBarEntry` shape.

- [ ] **Step 4: Commit**

```bash
git add src/inquiry/features/chat/tabs/TabBar.ts src/inquiry/style/components/tabs.css
git commit -m "feat: restore text-label tab strip with context menu and state dots"
```

---

### Task 9: Restore Old Toolbar Style (Separators, Send Button, Model Selector)

**Files:**
- Modify: `src/inquiry/features/chat/ui/InputToolbar.ts`
- Modify: `src/inquiry/style/toolbar/model-selector.css`
- Modify: `src/styles/archivist-layout-overrides.css`

- [ ] **Step 1: Update createInputToolbar to add separators**

In `src/inquiry/features/chat/ui/InputToolbar.ts`, find the `createInputToolbar()` factory function (around line 939). After each component creation, add a separator div:

After the model selector creation, add:
```typescript
toolbarEl.createDiv({ cls: 'archivist-toolbar-sep' });
```

After the thinking/effort selector, add another separator. After the context usage meter, add another. After the permission toggle, add the send button.

The exact code depends on the current factory function structure. The pattern to follow: between each toolbar section, insert `toolbarEl.createDiv({ cls: 'archivist-toolbar-sep' })`.

- [ ] **Step 2: Add send button to toolbar**

In the `createInputToolbar()` function, after all selectors and the permission toggle, add a send button:

```typescript
const sendBtn = toolbarEl.createDiv({ cls: 'archivist-send-btn' });
setIcon(sendBtn, 'send');
sendBtn.addEventListener('click', () => callbacks.onSend?.());
```

The `ToolbarCallbacks` interface needs `onSend?: () => void` added.

- [ ] **Step 3: Update model selector CSS for brand color always**

In `src/inquiry/style/toolbar/model-selector.css`, find:
```css
.claudian-model-btn { ... color: var(--text-muted); ... }
.claudian-model-btn.ready { color: var(--claudian-brand); }
```

Change to:
```css
.claudian-model-btn { ... color: var(--claudian-brand); ... }
```

Remove the `.ready` modifier rule since the color is always brand.

- [ ] **Step 4: Add toolbar override CSS**

In `src/styles/archivist-layout-overrides.css`, add:

```css
/* Toolbar: separators and old-style layout */
.claudian-input-toolbar {
  border-top: 1px solid var(--background-modifier-border-focus);
  font-size: 10px;
}

.archivist-toolbar-sep {
  width: 1px;
  height: 12px;
  background: var(--background-modifier-border);
  flex-shrink: 0;
}

/* Send button */
.archivist-send-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--claudian-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: auto;
  flex-shrink: 0;
}

.archivist-send-btn svg {
  width: 14px;
  height: 14px;
  color: white;
}

.archivist-send-btn:hover {
  opacity: 0.9;
}

/* Stop button (during streaming) */
.archivist-send-btn.streaming {
  background: var(--text-muted);
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/inquiry/features/chat/ui/InputToolbar.ts src/inquiry/style/toolbar/model-selector.css src/styles/archivist-layout-overrides.css
git commit -m "feat: restore old toolbar style with separators, brand send button, brand model selector"
```

---

### Task 10: Restore Code Block Header Bar

**Files:**
- Modify: `src/inquiry/features/chat/rendering/MessageRenderer.ts`
- Modify: `src/inquiry/style/components/code.css`

- [ ] **Step 1: Update code block rendering in MessageRenderer.ts**

In `src/inquiry/features/chat/rendering/MessageRenderer.ts`, find the code block wrapping logic in `renderContent()` (around lines 486-551). Currently it creates a floating language label. Change to create a header bar.

Find where it creates `claudian-code-lang-label`. Replace the floating label approach with a header bar:

```typescript
// Create header bar above code
const headerBar = wrapper.createDiv({ cls: 'archivist-code-header' });
const langLabel = headerBar.createSpan({ cls: 'archivist-code-lang', text: lang });
const copyBtn = headerBar.createSpan({ cls: 'archivist-code-copy', text: 'Copy' });
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(codeEl.textContent || '');
  copyBtn.setText('Copied!');
  setTimeout(() => copyBtn.setText('Copy'), 2000);
});

// Insert header before pre
wrapper.insertBefore(headerBar, pre);
```

Remove the old floating `.claudian-code-lang-label` creation.

- [ ] **Step 2: Update code CSS**

In `src/inquiry/style/components/code.css`, replace the content:

```css
/* Code block wrapper - bordered with header bar */
.claudian-code-wrapper {
  position: relative;
  margin: 8px 0;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  overflow: hidden;
}

.claudian-code-wrapper pre,
.claudian-message-content pre {
  padding: 8px 12px;
  overflow-x: auto;
  margin: 0;
}

.claudian-code-wrapper:not(.has-language) pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: hidden;
}

/* Header bar above code */
.archivist-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: var(--background-secondary);
  font-size: 11px;
  color: var(--text-muted);
}

.archivist-code-copy {
  cursor: pointer;
}

.archivist-code-copy:hover {
  color: var(--text-normal);
}

/* Hide Obsidian's default copy button when we have our own */
.claudian-code-wrapper.has-language .copy-code-button { display: none; }

/* Fallback copy button for blocks without language */
.claudian-code-wrapper .copy-code-button {
  position: absolute;
  top: 6px;
  inset-inline-end: 6px;
  opacity: 0;
  z-index: 2;
}
.claudian-code-wrapper:not(.has-language):hover .copy-code-button { opacity: 1; }
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/inquiry/features/chat/rendering/MessageRenderer.ts src/inquiry/style/components/code.css
git commit -m "feat: restore code block header bar with language label and copy button"
```

---

### Task 11: Fix System Prompt for Image/PDF Support

**Files:**
- Modify: `src/inquiry/core/prompts/dndContext.ts`

- [ ] **Step 1: Add image/PDF instructions to system prompt**

In `src/inquiry/core/prompts/dndContext.ts`, find the TOOLS section in `buildDndSystemPromptSection()`. After the line about vault search (`"For vault search: use your built-in Grep, Glob, Read tools within ${ctx.ttrpgRootDir}"`), add:

```typescript
- You can read images (PNG, JPG, GIF, WebP) in the vault for visual analysis using the Read tool.
- You can read PDF files using the Read tool with the pages parameter for specific page ranges.
- When searching the vault, consider all file types -- not just markdown. Use Glob to find images, PDFs, and other files, then Read to examine them.
```

Add these as template literal lines within the existing tools section string.

- [ ] **Step 2: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/core/prompts/dndContext.ts
git commit -m "fix: add image/PDF reading instructions to D&D system prompt"
```

---

### Task 12: Entity Generation Skeleton and Progressive Fill

This is the most complex task. It adds a skeleton placeholder during entity generation and progressive YAML parsing.

**Files:**
- Modify: `src/inquiry/features/chat/controllers/StreamController.ts`
- Modify: `src/inquiry/features/chat/rendering/ToolCallRenderer.ts`
- Modify: `src/styles/archivist-dnd.css`

- [ ] **Step 1: Add skeleton rendering functions to ToolCallRenderer.ts**

In `src/inquiry/features/chat/rendering/ToolCallRenderer.ts`, add these exports at the end of the file:

```typescript
/**
 * Detects if a tool name is a D&D entity generation tool.
 * Returns the entity type ('monster', 'spell', 'item') or null.
 */
export function getDndGenerationEntityType(toolName: string): string | null {
  if (toolName.includes('generate_monster')) return 'monster';
  if (toolName.includes('generate_spell')) return 'spell';
  if (toolName.includes('generate_item')) return 'item';
  return null;
}

/**
 * Renders a parchment-styled skeleton placeholder for D&D entity generation.
 * Returns an object with the wrapper element and an update function for progressive fill.
 */
export function renderBlockSkeleton(
  parentEl: HTMLElement,
  entityType: string,
): { el: HTMLElement; updateFromPartial: (data: Record<string, unknown>) => void; replaceWithFinal: (finalEl: HTMLElement) => void } {
  const wrapper = parentEl.createDiv({ cls: 'archivist-stat-block' });
  const skeleton = wrapper.createDiv({ cls: 'archivist-block-skeleton' });

  const typeLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  skeleton.createDiv({ cls: 'archivist-skeleton-header', text: `Generating ${typeLabel}...` });
  skeleton.createDiv({ cls: 'archivist-skeleton-bar' });
  skeleton.createDiv({ cls: 'archivist-skeleton-bar' });
  skeleton.createDiv({ cls: 'archivist-skeleton-bar archivist-skeleton-bar-short' });

  const updateFromPartial = (data: Record<string, unknown>) => {
    // Progressive fill: replace skeleton bars with actual content as fields arrive
    const existingPartial = skeleton.querySelector('.archivist-skeleton-partial');
    const partialEl = existingPartial || skeleton.createDiv({ cls: 'archivist-skeleton-partial' });
    if (!existingPartial) {
      // Remove placeholder bars when first partial data arrives
      skeleton.querySelectorAll('.archivist-skeleton-bar').forEach(bar => bar.remove());
    }
    partialEl.empty();

    if (data.name) {
      const nameEl = partialEl.createDiv({ cls: 'archivist-skeleton-name' });
      nameEl.setText(String(data.name));
      // Update header to show actual name
      const header = skeleton.querySelector('.archivist-skeleton-header');
      if (header) header.setText(String(data.name));
    }
    if (data.type || data.size) {
      const typeEl = partialEl.createDiv({ cls: 'archivist-skeleton-type' });
      const parts = [data.size, data.type].filter(Boolean);
      typeEl.setText(parts.join(' ') || '');
    }
    if (data.ac) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `AC: ${typeof data.ac === 'object' ? JSON.stringify(data.ac) : data.ac}` });
    }
    if (data.hp) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `HP: ${typeof data.hp === 'object' ? JSON.stringify(data.hp) : data.hp}` });
    }
    if (data.abilities) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: 'Abilities loaded...' });
    }
    // Spell-specific
    if (data.level !== undefined) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `Level ${data.level} ${data.school || ''}` });
    }
    if (data.casting_time) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `Casting Time: ${data.casting_time}` });
    }
    // Item-specific
    if (data.rarity) {
      partialEl.createDiv({ cls: 'archivist-skeleton-prop', text: `Rarity: ${data.rarity}` });
    }
  };

  const replaceWithFinal = (finalEl: HTMLElement) => {
    wrapper.empty();
    wrapper.appendChild(finalEl);
  };

  return { el: wrapper, updateFromPartial, replaceWithFinal };
}
```

- [ ] **Step 2: Add skeleton state tracking to StreamController.ts**

In `src/inquiry/features/chat/controllers/StreamController.ts`, add state for tracking active skeletons. Near the top of the class or in the state object, add:

```typescript
// Track active D&D entity skeletons for progressive fill
private activeSkeletons: Map<string, {
  skeleton: ReturnType<typeof renderBlockSkeleton>;
  accumulatedInput: string;
  lastValidParse: Record<string, unknown> | null;
}> = new Map();
```

Import the new functions at the top:
```typescript
import { getDndGenerationEntityType, renderBlockSkeleton } from '../rendering/ToolCallRenderer';
```

- [ ] **Step 3: Create skeleton on D&D tool call start**

In `handleRegularToolUse()` (around line 206), after the tool is added to `pendingTools`, check if it's a D&D generation tool and create a skeleton. Find where `pendingTools` is set and add after it:

```typescript
// For D&D generation tools, create skeleton immediately
const entityType = getDndGenerationEntityType(chunk.name);
if (entityType && state.currentContentEl) {
  // Flush any pending tools first so skeleton appears after tool header
  this.flushPendingTools(msg);
  const skeleton = renderBlockSkeleton(state.currentContentEl, entityType);
  this.activeSkeletons.set(chunk.id, {
    skeleton,
    accumulatedInput: '',
    lastValidParse: null,
  });
}
```

- [ ] **Step 4: Handle tool_input_delta for progressive parsing**

Find the chunk processing in `handleStreamChunk()` (the main switch). There should be a case for tool input delta (it may be handled in the SDK's streaming differently -- check how tool input arrives). If the SDK sends `tool_input_delta` or accumulates input via `tool_use` chunks, add progressive parsing:

In the appropriate handler (where tool input text accumulates), add:

```typescript
// Progressive D&D entity parsing
const skeletonState = this.activeSkeletons.get(toolId);
if (skeletonState) {
  skeletonState.accumulatedInput += inputDelta;
  try {
    const yaml = await import('js-yaml');
    const parsed = yaml.load(skeletonState.accumulatedInput);
    if (parsed && typeof parsed === 'object') {
      skeletonState.lastValidParse = parsed as Record<string, unknown>;
      skeletonState.skeleton.updateFromPartial(skeletonState.lastValidParse);
    }
  } catch {
    // Incomplete YAML -- silently ignore
  }
}
```

Note: The exact location depends on how the SDK streams tool input. The implementer should trace how `tool_use` chunks with `input` fields arrive and find the right hook point. The key: whenever new input text is available for a tool, check `activeSkeletons` and attempt progressive parse.

- [ ] **Step 5: Replace skeleton with final block on tool_result**

In `handleToolResult()` (around line 335), where D&D entities are rendered via `renderDndEntityAfterToolCall()`, add skeleton replacement. Before the entity render call, check for an active skeleton:

```typescript
const skeletonState = this.activeSkeletons.get(chunk.id);
if (skeletonState) {
  // The renderDndEntityAfterToolCall creates the entity element.
  // We need to replace the skeleton with it.
  // Remove skeleton from DOM
  skeletonState.skeleton.el.remove();
  this.activeSkeletons.delete(chunk.id);
}
```

The existing `renderDndEntityAfterToolCall()` call then creates the final block in the correct position.

- [ ] **Step 6: Add skeleton CSS**

In `src/styles/archivist-dnd.css`, add at the end:

```css
/* ========== Entity Generation Skeleton ========== */

.archivist-stat-block {
  max-width: 400px;
  margin: 8px 0;
}

.archivist-block-skeleton {
  background: var(--d5e-parchment, #fdf1dc);
  border: 1px solid var(--d5e-border-tan, #d9c484);
  border-radius: 3px;
  padding: 12px 16px;
  animation: archivist-skeleton-pulse 1.5s ease-in-out infinite;
}

.archivist-skeleton-header {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 16px;
  color: var(--d5e-text-accent, #7a200d);
  margin-bottom: 10px;
  font-weight: 700;
}

.archivist-skeleton-bar {
  height: 10px;
  background: rgba(122, 32, 13, 0.12);
  border-radius: 3px;
  margin-bottom: 8px;
}

.archivist-skeleton-bar-short {
  width: 60%;
}

.archivist-skeleton-partial {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 12px;
  color: var(--d5e-text-dark, #191813);
}

.archivist-skeleton-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--d5e-text-accent, #7a200d);
  margin-bottom: 4px;
}

.archivist-skeleton-type {
  font-size: 11px;
  font-style: italic;
  color: var(--d5e-text-dark, #191813);
  margin-bottom: 8px;
}

.archivist-skeleton-prop {
  font-size: 11px;
  color: var(--d5e-text-dark, #191813);
  margin-bottom: 3px;
  opacity: 0;
  animation: archivist-fade-in 0.3s ease forwards;
}

@keyframes archivist-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes archivist-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/inquiry/features/chat/controllers/StreamController.ts src/inquiry/features/chat/rendering/ToolCallRenderer.ts src/styles/archivist-dnd.css
git commit -m "feat: add skeleton placeholder and progressive fill for D&D entity generation"
```

---

### Task 13: @ Mention Inline Chip Rendering

**Files:**
- Modify: `src/inquiry/features/chat/rendering/MessageRenderer.ts`
- Modify: `src/styles/archivist-layout-overrides.css`

- [ ] **Step 1: Add mention post-processing to MessageRenderer.ts**

In `src/inquiry/features/chat/rendering/MessageRenderer.ts`, find `renderContent()` (around line 486). After the markdown is rendered and code blocks are processed, add a mention post-processing step. Add this function to the class:

```typescript
/**
 * Post-processes rendered HTML to replace @filename text with inline pill chips.
 */
private replaceInlineMentions(el: HTMLElement, mentionedFiles?: string[]): void {
  if (!mentionedFiles || mentionedFiles.length === 0) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const replacements: { node: Text; matches: { start: number; end: number; filename: string }[] }[] = [];

  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    // Skip nodes inside code blocks or pre elements
    if (textNode.parentElement?.closest('pre, code')) continue;

    const text = textNode.textContent || '';
    const matches: { start: number; end: number; filename: string }[] = [];

    for (const file of mentionedFiles) {
      const basename = file.split('/').pop() || file;
      const pattern = `@${basename}`;
      let idx = text.indexOf(pattern);
      while (idx !== -1) {
        const afterChar = text[idx + pattern.length];
        if (!afterChar || /[\s,.:;!?)}\]]/.test(afterChar)) {
          matches.push({ start: idx, end: idx + pattern.length, filename: basename });
        }
        idx = text.indexOf(pattern, idx + 1);
      }
    }

    if (matches.length > 0) {
      matches.sort((a, b) => a.start - b.start);
      replacements.push({ node: textNode, matches });
    }
  }

  for (const { node, matches } of replacements) {
    const text = node.textContent || '';
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const match of matches) {
      if (match.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, match.start)));
      }
      const chip = document.createElement('span');
      chip.className = 'archivist-inline-mention';
      const iconSpan = chip.createSpan({ cls: 'archivist-inline-mention-icon' });
      setIcon(iconSpan, 'file-text');
      chip.createSpan({ text: match.filename });
      fragment.appendChild(chip);
      lastEnd = match.end;
    }

    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    node.parentNode?.replaceChild(fragment, node);
  }
}
```

Then in `renderContent()`, after the D&D code fence replacement, call:
```typescript
this.replaceInlineMentions(el, options?.mentionedFiles);
```

The `options` parameter for `renderContent()` needs to accept `mentionedFiles?: string[]`. Update the method signature and pass it from callers that have file context.

- [ ] **Step 2: Add inline mention CSS**

In `src/styles/archivist-layout-overrides.css`, add:

```css
/* @ mention inline chips */
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
  white-space: nowrap;
}

.archivist-inline-mention-icon {
  display: inline-flex;
  align-items: center;
}

.archivist-inline-mention-icon svg {
  width: 12px;
  height: 12px;
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/inquiry/features/chat/rendering/MessageRenderer.ts src/styles/archivist-layout-overrides.css
git commit -m "feat: render @mentions as inline pill chips in chat messages"
```

---

### Task 14: Wire [[ Entity Autocomplete to Chat Input

**Files:**
- Modify: `src/inquiry/features/chat/tabs/types.ts`
- Modify: `src/inquiry/features/chat/tabs/Tab.ts`
- Modify: `src/styles/archivist-layout-overrides.css`

- [ ] **Step 1: Add entityAutocomplete to TabUIComponents**

In `src/inquiry/features/chat/tabs/types.ts`, find the `TabUIComponents` interface. Add:

```typescript
entityAutocomplete?: EntityAutocompleteDropdown;
```

Add the import at the top:
```typescript
import { EntityAutocompleteDropdown } from '../../shared/components/EntityAutocompleteDropdown';
```

- [ ] **Step 2: Instantiate EntityAutocompleteDropdown in Tab.ts**

In `src/inquiry/features/chat/tabs/Tab.ts`, find where other UI components are created (near `initializeTabControllers()` or the tab creation function). Add:

```typescript
import { EntityAutocompleteDropdown } from '../../shared/components/EntityAutocompleteDropdown';
```

After the file context manager or mention dropdown is created, instantiate the entity autocomplete:

```typescript
ui.entityAutocomplete = new EntityAutocompleteDropdown(
  dom.inputContainerEl, // or the appropriate parent element for the dropdown
  dom.inputEl,
  {
    entitySearch: (query: string, typeFilter?: string) => {
      return plugin.entityRegistry?.search(query, typeFilter) || [];
    },
    onSelect: (type: string, name: string) => {
      // Insert [[type:name]] at cursor
      const textarea = dom.inputEl;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      // Find the [[ trigger position
      const beforeCursor = text.slice(0, start);
      const triggerIdx = beforeCursor.lastIndexOf('[[');
      if (triggerIdx >= 0) {
        const insertion = type === 'doc' ? `[[${name}]]` : `[[${type}:${name}]]`;
        textarea.value = text.slice(0, triggerIdx) + insertion + text.slice(end);
        const newPos = triggerIdx + insertion.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.dispatchEvent(new Event('input'));
      }
    },
  }
);
```

Note: The exact constructor arguments depend on `EntityAutocompleteDropdown`'s constructor signature. The implementer should read the class and match the interface. The key callback is `entitySearch` which queries the entity registry.

- [ ] **Step 3: Wire keydown and input events**

In `wireTabInputEvents()` at `src/inquiry/features/chat/tabs/Tab.ts` (around line 929), add to the `keydownHandler`, BEFORE the Enter-to-send check:

```typescript
if (ui.entityAutocomplete?.handleKeydown(e)) { return; }
```

In the `inputHandler` (around line 980), add:

```typescript
ui.entityAutocomplete?.handleInput();
```

Also find `isAnyDropdownActive()` (around line 900) and add:

```typescript
if (ui.entityAutocomplete?.isVisible) return true;
```

- [ ] **Step 4: Add entity autocomplete CSS**

In `src/styles/archivist-layout-overrides.css`, add:

```css
/* [[ Entity autocomplete dropdown */
.archivist-entity-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
  z-index: 100;
  padding: 4px;
}

.archivist-entity-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.archivist-entity-dropdown-item:hover,
.archivist-entity-dropdown-item.selected {
  background: var(--background-modifier-hover);
}

.archivist-entity-dropdown-item-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.archivist-entity-dropdown-item-icon svg {
  width: 14px;
  height: 14px;
}

.archivist-entity-dropdown-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archivist-entity-dropdown-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.archivist-entity-dropdown-badge-srd {
  background: rgba(var(--claudian-brand-rgb), 0.15);
  color: var(--claudian-brand);
}

.archivist-entity-dropdown-badge-custom {
  background: rgba(0, 128, 0, 0.15);
  color: green;
}

.archivist-entity-dropdown-badge-doc {
  background: rgba(128, 128, 128, 0.15);
  color: var(--text-muted);
}
```

Note: The CSS class names must match what `EntityAutocompleteDropdown` uses. The implementer should check the class's `render()` method to see what CSS classes it outputs and align accordingly.

- [ ] **Step 5: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/inquiry/features/chat/tabs/types.ts src/inquiry/features/chat/tabs/Tab.ts src/styles/archivist-layout-overrides.css
git commit -m "feat: wire [[ entity autocomplete dropdown to chat input"
```

---

### Task 15: Update Textarea Placeholder

**Files:**
- Modify: `src/inquiry/features/chat/tabs/Tab.ts` (or wherever the textarea placeholder is set)

- [ ] **Step 1: Find and update placeholder text**

Search for the current textarea placeholder text in the codebase. It may be in `Tab.ts`, `TabManager.ts`, or the DOM creation code. Change it to:

```typescript
inputEl.placeholder = 'Ask the Archivist... (@ files, [[ entities, / commands)';
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat: update textarea placeholder to reference @, [[, and / features"
```

---

### Task 16: Final Build, Deploy, and Verify

**Files:**
- No new changes -- verification only

- [ ] **Step 1: Full build**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Run tests**

```bash
cd /Users/shinoobi/w/archivist-obsidian && npm test
```

Expected: All tests pass (or pre-existing failures only -- no new failures).

- [ ] **Step 3: Deploy to plugin directory**

```bash
cp /Users/shinoobi/w/archivist-obsidian/main.js /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/main.js
cp /Users/shinoobi/w/archivist-obsidian/styles.css /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/styles.css
```

- [ ] **Step 4: Manual verification checklist**

Reload the plugin in Obsidian and verify:

1. Welcome screen: Libre Baskerville greeting, brand-orange owl, "What knowledge do you seek?" subtitle
2. Tabs: Text-label strip with brand-orange active border, close button on hover, right-click menu
3. Thinking indicator: D&D-themed text with matching icon (no owl icon), pulsing in brand orange
4. Thinking blocks: No owl icon, just label + timer
5. Completion footer: D&D words ("Conjured in 8s", "Forged in 12s")
6. Toolbar: Separators between sections, brand-colored model name, 28px brand send button
7. Permission toggle: "Unleashed"/"Guarded" labels, `?` tooltip on hover
8. Code blocks: Header bar with language label + copy button
9. Generate monster: Tool call header appears, skeleton with "Generating Monster...", progressive fill as YAML streams, final stat block with Copy & Save button
10. Copy & Save: Copies YAML and saves note to vault
11. System prompt: Ask about an image in the vault -- AI should use Read tool on it
12. @ mentions: Type `@filename.md` in a message -- renders as inline pill chip after sending
13. `[[` autocomplete: Type `[[` in input -- dropdown appears. Type `[[monster:` -- filters to monsters. Enter selects.
14. Settings: Default model is Opus, 1M enabled for both, no thinkingBudget setting visible
