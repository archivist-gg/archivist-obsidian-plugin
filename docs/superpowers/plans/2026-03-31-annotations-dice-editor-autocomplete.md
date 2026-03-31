# Annotations, Dice Rolling & Editor Entity Autocomplete -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive D&D annotations (icons, dashed underlines, click-to-roll) in stat blocks and editor/chat, `[[monster:` entity autocomplete in the Obsidian editor, and 3D dice rolling via `@3d-dice/dice-box`.

**Architecture:** Three features in dependency order. C2: `EditorSuggest` subclass for `[[type:` filtering. B: Upgrade `renderStatBlockTag()` and `renderInlineTag()` with icons, dashed underlines, and click dispatch. A: Math dice roller (ported from original Archivist), DOM-based overlay, then `@3d-dice/dice-box` 3D integration. All dice clicks dispatch a `CustomEvent('archivist-dice-roll')` caught by the overlay manager.

**Tech Stack:** Obsidian API (`EditorSuggest`), Lucide icons via `setIcon()`, `@3d-dice/dice-box` v1.1.4, vanilla DOM (no React).

**Deploy:** After each build: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/extensions/entity-editor-suggest.ts` | `EditorSuggest` subclass for `[[monster:`, `[[spell:`, `[[item:` in editor |
| `src/dice/diceRoller.ts` | Pure math dice roller -- port from `/Users/shinoobi/w/archivist/client/src/utils/diceRoller.ts` |
| `src/dice/diceStats.ts` | `calculateAverage()`, `calculateRange()` for tooltips |
| `src/dice/DiceOverlay.ts` | Full-viewport overlay: shows dice canvas + result display |
| `src/dice/SimpleDiceBox.ts` | `@3d-dice/dice-box` singleton wrapper |
| `src/dice/index.ts` | Public API: `initDice()`, `rollDice3D()`, `getDiceStats()` |

### Modified Files
| File | Change |
|------|--------|
| `src/renderers/renderer-utils.ts` | Rewrite `renderStatBlockTag()` with icons + click handlers; update `renderInlineTag()` call site |
| `src/renderers/inline-tag-renderer.ts` | Replace pill badges with subtle inline style + icons + click handlers |
| `src/styles/archivist-dnd.css` | Replace `.archivist-stat-inline-*` and `.archivist-tag-*` styles |
| `src/main.ts` | Register `EntityEditorSuggest`, initialize dice system, listen for dice events |
| `package.json` | Add `@3d-dice/dice-box` dependency |
| `esbuild.config.mjs` | Copy dice-box assets to output |

---

## Task 1: Editor `[[` Entity Autocomplete (C2)

**Files:**
- Create: `src/extensions/entity-editor-suggest.ts`
- Modify: `src/main.ts:46-98`

- [ ] **Step 1: Create `EntityEditorSuggest`**

```typescript
// src/extensions/entity-editor-suggest.ts
import { EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Editor, EditorPosition, TFile, setIcon } from 'obsidian';
import type { SrdStore, SrdEntity } from '../ai/srd/srd-store';

const TYPE_PREFIXES: Record<string, string> = {
  monster: 'monster',
  spell: 'spell',
  item: 'magic-item',
  feat: 'feat',
};

const TYPE_ICONS: Record<string, string> = {
  monster: 'swords',
  spell: 'sparkles',
  'magic-item': 'scroll-text',
  feat: 'star',
};

export class EntityEditorSuggest extends EditorSuggest<SrdEntity> {
  private srdStore: SrdStore;

  constructor(app: any, srdStore: SrdStore) {
    super(app);
    this.srdStore = srdStore;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const textBefore = line.substring(0, cursor.ch);

    // Find last unmatched [[
    const lastBracket = textBefore.lastIndexOf('[[');
    if (lastBracket === -1) return null;

    const afterBrackets = textBefore.substring(lastBracket + 2);
    // If already closed, skip
    if (afterBrackets.includes(']]')) return null;

    // Must have a type prefix with colon (e.g., "monster:", "spell:fir")
    const colonIndex = afterBrackets.indexOf(':');
    if (colonIndex === -1) return null;

    const prefix = afterBrackets.substring(0, colonIndex).toLowerCase();
    if (!(prefix in TYPE_PREFIXES)) return null;

    return {
      start: { line: cursor.line, ch: lastBracket },
      end: cursor,
      query: afterBrackets,
    };
  }

  getSuggestions(context: EditorSuggestContext): SrdEntity[] {
    const query = context.query;
    const colonIndex = query.indexOf(':');
    if (colonIndex === -1) return [];

    const prefix = query.substring(0, colonIndex).toLowerCase();
    const entityType = TYPE_PREFIXES[prefix];
    if (!entityType) return [];

    const searchQuery = query.substring(colonIndex + 1).trim();
    return this.srdStore.search(searchQuery, entityType, 20);
  }

  renderSuggestion(entity: SrdEntity, el: HTMLElement): void {
    const container = el.createDiv({ cls: 'archivist-entity-suggest-item' });
    const iconEl = container.createSpan({ cls: 'archivist-entity-suggest-icon' });
    setIcon(iconEl, TYPE_ICONS[entity.entityType] ?? 'file-text');
    container.createSpan({ cls: 'archivist-entity-suggest-name', text: entity.name });
    container.createSpan({ cls: 'archivist-entity-suggest-type', text: entity.entityType.replace('magic-', '') });
  }

  selectSuggestion(entity: SrdEntity, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const editor = this.context.editor;
    const start = this.context.start;
    const end = this.context.end;
    // Replace [[type:query with [[Entity Name]]
    editor.replaceRange(`[[${entity.name}]]`, start, end);
  }
}
```

- [ ] **Step 2: Register in `main.ts`**

Add after the entity registry initialization (after line 67):

```typescript
// Editor entity suggest ([[monster:, [[spell:, [[item:)
import { EntityEditorSuggest } from './extensions/entity-editor-suggest';
// ... in onload(), after entity registry init:
this.registerEditorSuggest(new EntityEditorSuggest(this.app, this.srdStore!));
```

- [ ] **Step 3: Add suggest dropdown CSS**

Append to `src/styles/archivist-dnd.css`:

```css
/* Editor entity suggest dropdown */
.archivist-entity-suggest-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.archivist-entity-suggest-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.archivist-entity-suggest-icon svg {
  width: 16px;
  height: 16px;
}
.archivist-entity-suggest-name {
  flex: 1;
}
.archivist-entity-suggest-type {
  font-size: 11px;
  color: var(--text-faint);
  text-transform: capitalize;
}
```

- [ ] **Step 4: Build, deploy, test**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

Test: In Obsidian editor, type `[[monster:gob` -- should show Goblin in dropdown. Type `[[spell:fire` -- should show Fireball. Type `[[item:pot` -- should show potions. Plain `[[` without prefix should fall through to Obsidian native.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/entity-editor-suggest.ts src/main.ts src/styles/archivist-dnd.css
git commit -m "feat: add [[monster:/spell:/item: entity autocomplete in Obsidian editor"
```

---

## Task 2: Stat Block Annotation Rendering (B -- stat blocks)

**Files:**
- Modify: `src/renderers/renderer-utils.ts:91-128`
- Modify: `src/styles/archivist-dnd.css:300-317`

- [ ] **Step 1: Rewrite `renderStatBlockTag()` with icons and click handlers**

Replace the existing `renderStatBlockTag` function (lines 91-128) in `src/renderers/renderer-utils.ts`:

```typescript
import { setIcon } from 'obsidian';

interface StatTagConfig {
  iconName: string;
  cssClass: string;
  format: (content: string) => string;
  rollable: boolean;
}

const STAT_TAG_CONFIGS: Record<string, StatTagConfig> = {
  dice: { iconName: 'dices', cssClass: 'archivist-stat-tag-dice', format: (c) => c, rollable: true },
  damage: { iconName: 'dices', cssClass: 'archivist-stat-tag-damage', format: (c) => c, rollable: true },
  atk: { iconName: 'swords', cssClass: 'archivist-stat-tag-atk', format: (c) => `${c} to hit`, rollable: true },
  dc: { iconName: 'shield', cssClass: 'archivist-stat-tag-dc', format: (c) => `DC ${c}`, rollable: false },
  mod: { iconName: 'dices', cssClass: 'archivist-stat-tag-dice', format: (c) => c, rollable: true },
  check: { iconName: 'shield', cssClass: 'archivist-stat-tag-dc', format: (c) => c, rollable: false },
};

function renderStatBlockTag(tag: { type: string; content: string }): HTMLElement {
  const config = STAT_TAG_CONFIGS[tag.type];
  const span = document.createElement('span');

  if (!config) {
    span.textContent = tag.content;
    return span;
  }

  span.addClasses(['archivist-stat-tag', config.cssClass]);

  const iconEl = document.createElement('span');
  iconEl.addClass('archivist-stat-tag-icon');
  setIcon(iconEl, config.iconName);
  span.appendChild(iconEl);

  const textEl = document.createElement('span');
  textEl.textContent = config.format(tag.content);
  span.appendChild(textEl);

  if (config.rollable) {
    span.setAttribute('data-dice-notation', tag.content);
    span.setAttribute('data-dice-type', tag.type);
    span.setAttribute('title', `${tag.content} -- Click to roll`);
    span.addEventListener('click', () => {
      span.dispatchEvent(new CustomEvent('archivist-dice-roll', {
        bubbles: true,
        detail: { notation: tag.content, type: tag.type },
      }));
    });
  } else {
    span.setAttribute('title', config.format(tag.content));
  }

  return span;
}
```

- [ ] **Step 2: Replace stat block inline CSS**

Replace `.archivist-stat-inline-*` styles (lines 300-317 of `archivist-dnd.css`) with:

```css
/* Stat Block Interactive Tags (parchment theme) */
.archivist-stat-tag {
  display: inline;
}
.archivist-stat-tag-icon {
  display: inline;
  margin-right: 2px;
}
.archivist-stat-tag-icon svg {
  width: 14px;
  height: 14px;
  vertical-align: -2px;
  display: inline;
}
.archivist-stat-tag-dice,
.archivist-stat-tag-damage {
  color: #922610;
  border-bottom: 1px dashed #922610;
  cursor: pointer;
}
.archivist-stat-tag-dice:hover,
.archivist-stat-tag-damage:hover {
  color: #7a1a08;
  border-bottom-color: #7a1a08;
}
.archivist-stat-tag-atk {
  color: #7a200d;
  font-style: italic;
  cursor: pointer;
  border-bottom: 1px dashed #7a200d;
}
.archivist-stat-tag-dc {
  color: #191813;
}
.archivist-stat-tag-dc .archivist-stat-tag-icon svg {
  color: #555;
}
```

- [ ] **Step 3: Build, deploy, test**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

Test: Open a stat block with dice annotations. Verify: icons appear next to dice values, dashed underlines on rollable tags, cursor changes to pointer, hover darkens color. Click should dispatch event (visible in dev console: `document.addEventListener('archivist-dice-roll', e => console.log(e.detail))`).

- [ ] **Step 4: Commit**

```bash
git add src/renderers/renderer-utils.ts src/styles/archivist-dnd.css
git commit -m "feat: interactive stat block annotations with icons, dashed underlines, click dispatch"
```

---

## Task 3: Editor/Chat Annotation Rendering (B -- editor/chat)

**Files:**
- Modify: `src/renderers/inline-tag-renderer.ts`
- Modify: `src/styles/archivist-dnd.css:1168+` (replace pill badge styles)

- [ ] **Step 1: Rewrite `renderInlineTag()` with subtle inline style**

Replace the entire `src/renderers/inline-tag-renderer.ts`:

```typescript
import { setIcon } from 'obsidian';
import { InlineTag, InlineTagType } from '../parsers/inline-tag-parser';

interface InlineTagConfig {
  iconName: string;
  cssClass: string;
  format: (content: string) => string;
  rollable: boolean;
}

const INLINE_TAG_CONFIGS: Record<InlineTagType, InlineTagConfig> = {
  dice: { iconName: 'dices', cssClass: 'archivist-tag-dice', format: (c) => c, rollable: true },
  damage: { iconName: 'dices', cssClass: 'archivist-tag-damage', format: (c) => c, rollable: true },
  dc: { iconName: 'shield', cssClass: 'archivist-tag-dc', format: (c) => `DC ${c}`, rollable: false },
  atk: { iconName: 'swords', cssClass: 'archivist-tag-atk', format: (c) => `${c} to hit`, rollable: true },
  mod: { iconName: 'dices', cssClass: 'archivist-tag-dice', format: (c) => c, rollable: true },
  check: { iconName: 'shield', cssClass: 'archivist-tag-dc', format: (c) => c, rollable: false },
};

export function renderInlineTag(tag: InlineTag): HTMLElement {
  const config = INLINE_TAG_CONFIGS[tag.type];

  const span = document.createElement('span');
  span.addClasses(['archivist-tag', config.cssClass]);

  const iconEl = document.createElement('span');
  iconEl.addClass('archivist-tag-icon');
  setIcon(iconEl, config.iconName);
  span.appendChild(iconEl);

  const textEl = document.createElement('span');
  textEl.textContent = config.format(tag.content);
  span.appendChild(textEl);

  if (config.rollable) {
    span.setAttribute('data-dice-notation', tag.content);
    span.setAttribute('data-dice-type', tag.type);
    span.setAttribute('title', `${tag.content} -- Click to roll`);
    span.addEventListener('click', () => {
      span.dispatchEvent(new CustomEvent('archivist-dice-roll', {
        bubbles: true,
        detail: { notation: tag.content, type: tag.type },
      }));
    });
  }

  return span;
}
```

- [ ] **Step 2: Replace pill badge CSS with subtle inline styles**

Replace the entire `.archivist-tag` block (starting at line ~1168 of `archivist-dnd.css`) with:

```css
/* Editor/Chat Inline Tags -- Warm Gold / Cool Teal / Soft Red */
.archivist-tag {
  display: inline;
}
.archivist-tag-icon {
  display: inline;
  margin-right: 2px;
}
.archivist-tag-icon svg {
  width: 12px;
  height: 12px;
  vertical-align: -1px;
  display: inline;
}

/* Dark mode (default for Obsidian) */
.archivist-tag-dice,
.archivist-tag-damage {
  color: #d4a843;
  border-bottom: 1px dashed rgba(212, 168, 67, 0.45);
  cursor: pointer;
}
.archivist-tag-dice:hover,
.archivist-tag-damage:hover {
  color: #e8bc4d;
  border-bottom-color: rgba(232, 188, 77, 0.6);
}
.archivist-tag-dc {
  color: #5ba3b5;
}
.archivist-tag-atk {
  color: #d47070;
  font-style: italic;
}
.archivist-tag-atk .archivist-tag-icon svg {
  color: #d47070;
}

/* Light mode overrides */
body.theme-light .archivist-tag-dice,
body.theme-light .archivist-tag-damage {
  color: #9a7520;
  border-bottom-color: rgba(154, 117, 32, 0.45);
}
body.theme-light .archivist-tag-dice:hover,
body.theme-light .archivist-tag-damage:hover {
  color: #7a5d18;
  border-bottom-color: rgba(122, 93, 24, 0.6);
}
body.theme-light .archivist-tag-dc {
  color: #2a7a8c;
}
body.theme-light .archivist-tag-atk {
  color: #b84040;
}
body.theme-light .archivist-tag-atk .archivist-tag-icon svg {
  color: #b84040;
}
```

- [ ] **Step 3: Build, deploy, test**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

Test: In the Archivist Inquiry chat, check that inline tags in AI responses render with colored text + icons + dashed underlines (not pill badges). Switch between dark and light mode to verify both color sets. In Obsidian editor, backtick tags like `` `dice:2d6+3` `` should render as inline tags via the post-processor.

- [ ] **Step 4: Commit**

```bash
git add src/renderers/inline-tag-renderer.ts src/styles/archivist-dnd.css
git commit -m "feat: replace pill badge tags with subtle inline style (gold/teal/red, dashed underline)"
```

---

## Task 4: Math Dice Roller + Stats (A1)

**Files:**
- Create: `src/dice/diceRoller.ts`
- Create: `src/dice/diceStats.ts`

- [ ] **Step 1: Port `diceRoller.ts` from original Archivist**

Copy from `/Users/shinoobi/w/archivist/client/src/utils/diceRoller.ts` to `src/dice/diceRoller.ts`. The file is self-contained (no external dependencies). Keep all exports: `rollDice`, `rollD20`, `rollRecharge`, `rollPercentile`, `rollD100`, `checkCritical`, `formatDiceRoll`, and interfaces `DiceRoll`, `DiceRollResult`.

- [ ] **Step 2: Create `diceStats.ts` for tooltip calculations**

```typescript
// src/dice/diceStats.ts

export interface DiceStats {
  average: number;
  min: number;
  max: number;
}

/**
 * Calculate average, min, max for a dice notation like "2d6+3"
 */
export function calculateDiceStats(notation: string): DiceStats | null {
  const clean = notation.trim().toLowerCase();
  const match = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return null;

  const numDice = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  return {
    average: numDice * (sides + 1) / 2 + modifier,
    min: numDice + modifier,
    max: numDice * sides + modifier,
  };
}

/**
 * Format dice stats for tooltip display
 */
export function formatDiceTooltip(notation: string): string {
  const stats = calculateDiceStats(notation);
  if (!stats) return `${notation} -- Click to roll`;
  return `${notation} (avg ${stats.average}, range ${stats.min}-${stats.max}) -- Click to roll`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/dice/diceRoller.ts src/dice/diceStats.ts
git commit -m "feat: add math dice roller + stats calculator (ported from original Archivist)"
```

---

## Task 5: Dice Overlay + Global API (A2)

**Files:**
- Create: `src/dice/DiceOverlay.ts`
- Create: `src/dice/index.ts`
- Modify: `src/main.ts`
- Modify: `src/renderers/renderer-utils.ts` (wire tooltip text)
- Add CSS to: `src/styles/archivist-dnd.css`

- [ ] **Step 1: Create `DiceOverlay.ts`**

```typescript
// src/dice/DiceOverlay.ts
import { setIcon } from 'obsidian';
import { rollDice, formatDiceRoll, DiceRoll } from './diceRoller';

export class DiceOverlay {
  private overlayEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;
  private canvasEl: HTMLElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  show(): void {
    if (this.overlayEl) return;

    this.overlayEl = document.body.createDiv({ cls: 'archivist-dice-overlay' });
    this.canvasEl = this.overlayEl.createDiv({ cls: 'archivist-dice-canvas', attr: { id: 'archivist-dice-box' } });
    this.resultEl = this.overlayEl.createDiv({ cls: 'archivist-dice-result' });

    // Click outside to dismiss
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.hide();
    });

    // Escape to dismiss
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.escHandler);
  }

  hide(): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this.escHandler) document.removeEventListener('keydown', this.escHandler);
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
      this.resultEl = null;
      this.canvasEl = null;
    }
  }

  showResult(roll: DiceRoll): void {
    if (!this.resultEl) return;
    this.resultEl.empty();

    const notation = this.resultEl.createDiv({ cls: 'archivist-dice-result-notation', text: roll.notation });
    const details = this.resultEl.createDiv({ cls: 'archivist-dice-result-details', text: roll.details });
    const total = this.resultEl.createDiv({ cls: 'archivist-dice-result-total', text: String(roll.total) });

    this.resultEl.addClass('visible');

    // Auto-hide after 2.5s
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hide(), 2500);
  }

  /**
   * Roll with math fallback (no 3D yet). Shows overlay with result.
   */
  rollMath(notation: string): DiceRoll | null {
    this.show();
    const result = rollDice(notation);
    if (result.success && result.roll) {
      this.showResult(result.roll);
      return result.roll;
    }
    this.hide();
    return null;
  }

  getCanvasId(): string {
    return 'archivist-dice-box';
  }

  isVisible(): boolean {
    return this.overlayEl !== null;
  }
}
```

- [ ] **Step 2: Create `src/dice/index.ts` -- public API**

```typescript
// src/dice/index.ts
export { DiceOverlay } from './DiceOverlay';
export { rollDice, rollD20, rollRecharge, formatDiceRoll } from './diceRoller';
export type { DiceRoll, DiceRollResult } from './diceRoller';
export { calculateDiceStats, formatDiceTooltip } from './diceStats';
export type { DiceStats } from './diceStats';
```

- [ ] **Step 3: Wire dice event listener in `main.ts`**

Add in `onload()` after editor extensions:

```typescript
import { DiceOverlay } from './dice';

// ... in onload():
const diceOverlay = new DiceOverlay();

// Listen for dice roll events from annotations
this.registerDomEvent(document, 'archivist-dice-roll' as any, (e: CustomEvent) => {
  const { notation } = e.detail;
  if (notation) diceOverlay.rollMath(notation);
});
```

- [ ] **Step 4: Update tooltip text in `renderStatBlockTag`**

In `src/renderers/renderer-utils.ts`, add import and update the title attribute:

```typescript
import { formatDiceTooltip } from './dice/diceStats';

// In renderStatBlockTag(), replace the title line for rollable tags:
span.setAttribute('title', formatDiceTooltip(tag.content));
```

Do the same in `src/renderers/inline-tag-renderer.ts` for the editor/chat tags.

- [ ] **Step 5: Add overlay CSS**

Append to `src/styles/archivist-dnd.css`:

```css
/* Dice Roll Overlay */
.archivist-dice-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.archivist-dice-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}
.archivist-dice-result {
  position: relative;
  z-index: 1;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.archivist-dice-result.visible {
  opacity: 1;
}
.archivist-dice-result-notation {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
}
.archivist-dice-result-details {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 8px;
}
.archivist-dice-result-total {
  font-size: 48px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 6: Build, deploy, test**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

Test: Click a dice annotation in a stat block (e.g., `2d6+3`). Overlay should appear with dark backdrop, show the roll result (notation, details, total), auto-hide after 2.5s. Click outside or press Escape to dismiss early. Tooltip on hover should show "2d6+3 (avg 10, range 5-15) -- Click to roll".

- [ ] **Step 7: Commit**

```bash
git add src/dice/ src/main.ts src/renderers/renderer-utils.ts src/renderers/inline-tag-renderer.ts src/styles/archivist-dnd.css
git commit -m "feat: dice overlay with math roller, click-to-roll from annotations"
```

---

## Task 6: 3D Dice Integration (A3)

**Files:**
- Create: `src/dice/SimpleDiceBox.ts`
- Modify: `src/dice/DiceOverlay.ts`
- Modify: `package.json`
- Modify: `esbuild.config.mjs`

- [ ] **Step 1: Install `@3d-dice/dice-box`**

```bash
npm install @3d-dice/dice-box@^1.1.4
```

- [ ] **Step 2: Create `SimpleDiceBox.ts`**

Port from `/Users/shinoobi/w/archivist/client/src/utils/simpleDiceBox.ts` with Obsidian asset path adaptation:

```typescript
// src/dice/SimpleDiceBox.ts
import DiceBox from '@3d-dice/dice-box';

export class SimpleDiceBox {
  private static instance: SimpleDiceBox;
  private diceBox: DiceBox | null = null;
  private isReady = false;
  private readyCallbacks: Array<() => void> = [];

  static getInstance(): SimpleDiceBox {
    if (!SimpleDiceBox.instance) {
      SimpleDiceBox.instance = new SimpleDiceBox();
    }
    return SimpleDiceBox.instance;
  }

  async initialize(containerId: string, assetPath: string): Promise<void> {
    if (this.isReady) return;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const container = document.querySelector(containerId);
    if (!container) throw new Error(`Container not found: ${containerId}`);

    this.diceBox = new DiceBox({
      container: containerId,
      assetPath,
      gravity: 3,
      mass: 2.5,
      friction: 0.8,
      restitution: 0.2,
      linearDamping: 0.5,
      angularDamping: 0.4,
      spinForce: 4,
      throwForce: 5,
      startingHeight: 8,
      settleTimeout: 5000,
      delay: 10,
      lightIntensity: 1.2,
      ambientLightIntensity: 0.5,
      shadowTransparency: 0.8,
      theme: 'default',
      themeColor: '#1a1a1a',
      scale: 6,
      sounds: { enabled: false, volume: 0 },
      enableShadows: true,
    });

    await this.diceBox.init();
    this.isReady = true;
    this.readyCallbacks.forEach((cb) => cb());
    this.readyCallbacks = [];
  }

  async roll(notation: string): Promise<void> {
    if (!this.isReady || !this.diceBox) {
      await this.waitForReady();
    }
    if (this.diceBox) {
      await this.diceBox.clear();
      await this.diceBox.roll(notation);
    }
  }

  onRollComplete(callback: (result: any) => void): void {
    if (this.diceBox) {
      this.diceBox.onRollComplete = callback;
    }
  }

  private waitForReady(): Promise<void> {
    if (this.isReady) return Promise.resolve();
    return new Promise((resolve) => {
      this.readyCallbacks.push(resolve);
    });
  }
}

export const simpleDiceBox = SimpleDiceBox.getInstance();
```

- [ ] **Step 3: Update `DiceOverlay.ts` to use 3D dice**

Add 3D rolling method alongside the existing math fallback:

```typescript
import { simpleDiceBox } from './SimpleDiceBox';

// Add to DiceOverlay class:
private is3DInitialized = false;

async initialize3D(assetPath: string): Promise<void> {
  try {
    this.show();
    await simpleDiceBox.initialize(`#${this.getCanvasId()}`, assetPath);
    simpleDiceBox.onRollComplete((results: any) => {
      // Extract total from dice-box results
      const total = results.reduce((sum: number, r: any) => sum + r.value, 0);
      const rolls = results.map((r: any) => r.value);
      const notation = results.map((r: any) => `${r.qty || 1}d${r.sides}`).join('+');
      this.showResult({
        notation,
        rolls,
        modifier: 0,
        total,
        details: rolls.join(' + ') + ` = ${total}`,
      });
    });
    this.is3DInitialized = true;
    this.hide();
  } catch (err) {
    console.warn('3D dice init failed, using math fallback:', err);
  }
}

async roll3D(notation: string): Promise<DiceRoll | null> {
  if (!this.is3DInitialized) {
    return this.rollMath(notation);
  }
  this.show();
  try {
    await simpleDiceBox.roll(notation);
    // Result handled by onRollComplete callback
    return null; // async -- result comes via callback
  } catch {
    return this.rollMath(notation);
  }
}
```

- [ ] **Step 4: Copy dice-box assets in build**

Update `esbuild.config.mjs` (or create a post-build script) to copy assets:

```javascript
// Add to build script:
import { cpSync } from 'fs';

// After esbuild completes:
cpSync(
  'node_modules/@3d-dice/dice-box/src/assets',
  'assets/dice-box',
  { recursive: true }
);
```

The plugin will reference assets from the plugin directory at runtime. In `main.ts`, pass the asset path:

```typescript
// In onload(), after diceOverlay creation:
const pluginDir = this.app.vault.configDir + '/plugins/archivist-ttrpg-blocks';
diceOverlay.initialize3D(pluginDir + '/assets/dice-box/');
```

- [ ] **Step 5: Update event listener to use 3D**

In `main.ts`, update the dice event handler:

```typescript
this.registerDomEvent(document, 'archivist-dice-roll' as any, (e: CustomEvent) => {
  const { notation } = e.detail;
  if (notation) diceOverlay.roll3D(notation);
});
```

- [ ] **Step 6: Build, deploy, test**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

Also copy the dice-box assets:
```bash
/bin/cp -r assets/dice-box /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/assets/dice-box
```

Test: Click a dice annotation. 3D dice should appear in the overlay, roll with physics, settle, and show the result. If 3D fails, math fallback should still work.

- [ ] **Step 7: Commit**

```bash
git add src/dice/SimpleDiceBox.ts src/dice/DiceOverlay.ts src/dice/index.ts src/main.ts package.json esbuild.config.mjs
git commit -m "feat: 3D dice rolling with @3d-dice/dice-box, physics overlay, math fallback"
```

---

## Summary

| Task | Feature | Files | Description |
|------|---------|-------|-------------|
| 1 | C2 | `entity-editor-suggest.ts`, `main.ts` | `[[monster:` etc. in Obsidian editor |
| 2 | B (stat) | `renderer-utils.ts`, CSS | Interactive stat block tags (dashed underline + icons) |
| 3 | B (chat) | `inline-tag-renderer.ts`, CSS | Subtle inline tags for editor/chat (gold/teal/red) |
| 4 | A1 | `diceRoller.ts`, `diceStats.ts` | Math dice roller + stats for tooltips |
| 5 | A2 | `DiceOverlay.ts`, `index.ts`, `main.ts` | Overlay + click-to-roll wiring |
| 6 | A3 | `SimpleDiceBox.ts`, `DiceOverlay.ts`, build | 3D dice via `@3d-dice/dice-box` |
