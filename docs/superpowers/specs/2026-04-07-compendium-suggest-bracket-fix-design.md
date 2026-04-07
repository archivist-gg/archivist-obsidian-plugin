# Fix Compendium Suggest Blocked by Obsidian Bracket Matching

**Date:** 2026-04-07
**Status:** Approved

## Problem

When typing `{{` in the Obsidian editor, the built-in `closeBrackets` extension (CodeMirror 6) auto-inserts `}}`, placing the cursor at `{{|}}`. The `onTrigger` guard in `compendium-suggest.ts` line 51 (`if (textAfter.startsWith("}}")) return null`) sees the auto-inserted `}}` and kills the trigger. The entity autocomplete popup never appears.

Furthermore, even if the initial trigger fired, the guard would re-suppress the suggest on every subsequent keystroke (e.g. `{{m|}}`) because the auto-inserted `}}` persists after the cursor throughout the entire typing flow.

## Solution

Two targeted changes in `src/extensions/compendium-suggest.ts`:

### 1. `onTrigger`: Remove the trailing `}}` guard entirely

The guard on line 51 (`if (textAfter.startsWith("}}")) return null`) was intended to prevent the suggest from firing when the cursor is inside a completed reference. However, the existing guard on line 46 (`if (afterOpen.includes("}}")) return null`) already handles the case where the cursor is *after* a completed `}}` — it checks whether `}}` appears in the text between `{{` and the cursor.

The line 51 guard is redundant for completed references and actively harmful when bracket matching is active, because the auto-inserted `}}` persists after the cursor throughout the entire typing flow (`{{|}}` -> `{{m|}}` -> `{{monster:gob|}}`).

**Change:** Remove lines 48-51 (the `textAfter` guard block).

### 2. `selectSuggestion`: Consume trailing `}}`

When inserting the selected entity, check if `}}` follows the current cursor position and extend the replacement range to consume it. This prevents double-closing braces (`{{monster:goblin}}}}`).

**Before:**
```ts
editor.replaceRange(`{{${entity.entityType}:${entity.slug}}}`, start, end);
```

**After:**
```ts
const line = editor.getLine(end.line);
const textAfter = line.substring(end.ch);
const adjustedEnd = textAfter.startsWith("}}")
  ? { line: end.line, ch: end.ch + 2 }
  : end;
editor.replaceRange(`{{${entity.entityType}:${entity.slug}}}`, start, adjustedEnd);
```

## Scope

- File changed: `src/extensions/compendium-suggest.ts`
- No Obsidian internals touched (no `closeBrackets` override)
- No changes to `getSuggestions`, `renderSuggestion`, or the compendium ref parser
- Bracket matching continues to work normally for all other `{` usage

## Edge Cases

- **Cursor after completed reference:** `some text {{monster:goblin}}|` — `lastIndexOf("{{")` finds `{{`, `afterOpen` is `monster:goblin}}` which contains `}}` — line 46 catches this and returns null. Correct.
- **Bracket matching active, typing query:** `{{monster:gob|}}` — `afterOpen` is `monster:gob`, no `}}` in it, trigger fires with query `monster:gob`. The suggest shows monster matches for "gob". On selection, `selectSuggestion` consumes the trailing `}}`. Correct.
- **Cursor clicked inside completed reference:** `{{monster:gob|lin}}` — `afterOpen` is `monster:gob`, no `}}` in it, trigger fires. Suggest shows results for "gob" — reasonable behavior if the user is editing a reference.
- **No bracket matching (user disabled it):** `{{monster:gob|` — no `}}` after cursor, `selectSuggestion` doesn't extend the range. No harm.
- **Multiple references on same line:** `{{monster:goblin}} text {{sp|}}` — `lastIndexOf("{{")` finds the second `{{`, `afterOpen` is `sp`, no `}}` in it, trigger fires correctly for the second reference.
