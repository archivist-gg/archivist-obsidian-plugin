# Compendium Suggest Bracket Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the compendium entity suggest popup being blocked by Obsidian's auto-inserted `}}` when typing `{{`.

**Architecture:** Remove the redundant trailing `}}` guard from `onTrigger` and extend `selectSuggestion` to consume auto-inserted `}}` before inserting the replacement text.

**Tech Stack:** TypeScript, Obsidian API (`EditorSuggest`)

---

### Task 1: Write tests for onTrigger bracket matching behavior

**Files:**
- Create: `tests/compendium-suggest.test.ts`
- Reference: `src/extensions/compendium-suggest.ts`

- [ ] **Step 1: Write the failing tests**

The `onTrigger` method needs a mock `Editor` to test. Write tests that verify the trigger fires in bracket-matching scenarios.

```typescript
import { describe, it, expect } from "vitest";

/**
 * Test the onTrigger logic extracted as a pure function.
 * We test the detection algorithm directly rather than mocking
 * the full EditorSuggest class.
 */

function detectCompendiumTrigger(
  line: string,
  cursorCh: number
): { start: number; end: number; query: string } | null {
  const textBefore = line.substring(0, cursorCh);
  const lastOpen = textBefore.lastIndexOf("{{");
  if (lastOpen === -1) return null;

  const afterOpen = textBefore.substring(lastOpen + 2);
  if (afterOpen.includes("}}")) return null;

  return {
    start: lastOpen,
    end: cursorCh,
    query: afterOpen,
  };
}

describe("compendium suggest trigger detection", () => {
  it("triggers on {{ with bracket matching (cursor between {{ and }})", () => {
    // User typed {{ and Obsidian auto-inserted }}, cursor at {{|}}
    const result = detectCompendiumTrigger("{{}}", 2);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("");
  });

  it("triggers while typing query with bracket matching", () => {
    // User typing inside bracket-matched braces: {{m|}}
    const result = detectCompendiumTrigger("{{m}}", 3);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("m");
  });

  it("triggers with type prefix and bracket matching", () => {
    // {{monster:gob|}}
    const result = detectCompendiumTrigger("{{monster:gob}}", 14);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("monster:gob");
  });

  it("does not trigger when cursor is after a completed reference", () => {
    // {{monster:goblin}}|
    const result = detectCompendiumTrigger("{{monster:goblin}}", 18);
    expect(result).toBeNull();
  });

  it("does not trigger with no {{ present", () => {
    const result = detectCompendiumTrigger("some text", 5);
    expect(result).toBeNull();
  });

  it("triggers on second reference when first is completed", () => {
    // {{monster:goblin}} text {{sp|}}
    const result = detectCompendiumTrigger("{{monster:goblin}} text {{sp}}", 28);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("sp");
  });

  it("triggers on {{ without bracket matching", () => {
    // User disabled bracket matching: {{monster:gob|
    const result = detectCompendiumTrigger("{{monster:gob", 13);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("monster:gob");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/compendium-suggest.test.ts`

Expected: All tests PASS — these test the pure detection function defined inline in the test file, not the actual `onTrigger` method yet. This validates the algorithm we want the production code to match.

- [ ] **Step 3: Commit**

```bash
git add tests/compendium-suggest.test.ts
git commit -m "test: add compendium suggest trigger detection tests"
```

---

### Task 2: Remove the trailing `}}` guard from onTrigger

**Files:**
- Modify: `src/extensions/compendium-suggest.ts:48-51`

- [ ] **Step 1: Remove the trailing `}}` guard**

In `src/extensions/compendium-suggest.ts`, delete lines 48-51 (the `textAfter` check block):

```typescript
    // Also check the rest of the line after the cursor for a closing `}}`
    // that would mean we're inside a completed tag
    const textAfter = line.substring(cursor.ch);
    if (textAfter.startsWith("}}")) return null;
```

The `onTrigger` method should now read:

```typescript
  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const textBefore = line.substring(0, cursor.ch);
    const lastOpen = textBefore.lastIndexOf("{{");
    if (lastOpen === -1) return null;

    // Check there's no closing `}}` after the opening `{{`
    const afterOpen = textBefore.substring(lastOpen + 2);
    if (afterOpen.includes("}}")) return null;

    return {
      start: { line: cursor.line, ch: lastOpen },
      end: cursor,
      query: afterOpen,
    };
  }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/compendium-suggest.test.ts`
Expected: All PASS (the test's inline function already matches this logic)

- [ ] **Step 3: Commit**

```bash
git add src/extensions/compendium-suggest.ts
git commit -m "fix: remove trailing }} guard that blocked suggest with bracket matching"
```

---

### Task 3: Update selectSuggestion to consume trailing `}}`

**Files:**
- Modify: `src/extensions/compendium-suggest.ts:96-102`

- [ ] **Step 1: Update selectSuggestion to consume auto-inserted `}}`**

Replace the `selectSuggestion` method body in `src/extensions/compendium-suggest.ts`:

**Before:**
```typescript
  selectSuggestion(entity: RegisteredEntity, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const editor = this.context.editor;
    const start = this.context.start;
    const end = this.context.end;
    editor.replaceRange(`{{${entity.entityType}:${entity.slug}}}`, start, end);
  }
```

**After:**
```typescript
  selectSuggestion(entity: RegisteredEntity, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const editor = this.context.editor;
    const start = this.context.start;
    const end = this.context.end;

    // Consume auto-inserted }} from Obsidian's bracket matching
    const line = editor.getLine(end.line);
    const textAfter = line.substring(end.ch);
    const adjustedEnd = textAfter.startsWith("}}")
      ? { line: end.line, ch: end.ch + 2 }
      : end;

    editor.replaceRange(`{{${entity.entityType}:${entity.slug}}}`, start, adjustedEnd);
  }
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/extensions/compendium-suggest.ts
git commit -m "fix: consume auto-inserted }} when selecting compendium suggestion"
```

---

### Task 4: Build, deploy, and verify

**Files:**
- Reference: `src/extensions/compendium-suggest.ts`

- [ ] **Step 1: Build the plugin**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/`
Expected: Build succeeds with no errors

- [ ] **Step 2: Manual verification in Obsidian**

Reload Obsidian and test:
1. Type `{{` — suggest popup should appear immediately
2. Type a query like `gob` — popup should show matching entities as you type
3. Select an entity — should insert `{{monster:goblin}}` (no extra `}}`)
4. Verify existing `{{type:slug}}` references still render correctly
5. Click inside a completed reference — verify behavior is reasonable

- [ ] **Step 3: Final commit if any adjustments needed**

If manual testing reveals issues, fix and commit.
