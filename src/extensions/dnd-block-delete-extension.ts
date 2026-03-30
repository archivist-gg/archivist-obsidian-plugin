import { keymap } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

const DND_FENCE_RE = /^```(monster|spell|item)\s*$/;

/**
 * Finds the full range of a D&D fenced code block by scanning the raw
 * document text around the cursor. This is more reliable than walking
 * the syntax tree because Obsidian's registerMarkdownCodeBlockProcessor
 * renders widgets that don't always align with CM6 tree nodes.
 */
function findDndCodeBlockRange(
  view: EditorView,
): { from: number; to: number } | null {
  const { state } = view;
  const pos = state.selection.main.head;
  const doc = state.doc;

  // Get the line at the cursor
  const cursorLine = doc.lineAt(pos);

  // Search outward from cursor line to find opening and closing fences
  // Check if cursor is ON a fence line, or inside a code block

  // Strategy: look backward for opening fence, forward for closing fence
  let openLine: { from: number; to: number; number: number } | null = null;
  let closeLine: { from: number; to: number; number: number } | null = null;

  // First check: is the cursor line itself an opening fence?
  if (DND_FENCE_RE.test(cursorLine.text)) {
    openLine = cursorLine;
    // Find matching close
    for (let i = cursorLine.number + 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (line.text.trimEnd() === "```") {
        closeLine = line;
        break;
      }
    }
  }
  // Check: is cursor line a closing fence? Look backward for opening.
  else if (cursorLine.text.trimEnd() === "```") {
    closeLine = cursorLine;
    for (let i = cursorLine.number - 1; i >= 1; i--) {
      const line = doc.line(i);
      if (DND_FENCE_RE.test(line.text)) {
        openLine = line;
        break;
      }
      // If we hit another closing fence, stop
      if (line.text.trimEnd() === "```") break;
    }
  }
  // Check: is cursor between an opening and closing fence?
  else {
    // Look backward for opening fence
    for (let i = cursorLine.number - 1; i >= 1; i--) {
      const line = doc.line(i);
      if (DND_FENCE_RE.test(line.text)) {
        openLine = line;
        break;
      }
      // Stop if we hit a closing fence (means we're outside a block)
      if (line.text.trimEnd() === "```") break;
    }
    if (openLine) {
      // Look forward for closing fence
      for (let i = cursorLine.number + 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        if (line.text.trimEnd() === "```") {
          closeLine = line;
          break;
        }
      }
    }
  }

  // Also check: cursor might be on the line right before or after a block
  // (at the widget boundary in live preview)
  if (!openLine || !closeLine) {
    // Check line below cursor — is it an opening fence?
    if (cursorLine.number < doc.lines) {
      const nextLine = doc.line(cursorLine.number + 1);
      if (DND_FENCE_RE.test(nextLine.text)) {
        openLine = nextLine;
        closeLine = null;
        for (let i = nextLine.number + 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          if (line.text.trimEnd() === "```") {
            closeLine = line;
            break;
          }
        }
      }
    }
  }

  if (!openLine || !closeLine) {
    // Check line above cursor — is it a closing fence?
    if (!openLine && !closeLine && cursorLine.number > 1) {
      const prevLine = doc.line(cursorLine.number - 1);
      if (prevLine.text.trimEnd() === "```") {
        closeLine = prevLine;
        for (let i = prevLine.number - 1; i >= 1; i--) {
          const line = doc.line(i);
          if (DND_FENCE_RE.test(line.text)) {
            openLine = line;
            break;
          }
          if (line.text.trimEnd() === "```") break;
        }
      }
    }
  }

  if (!openLine || !closeLine) return null;

  // Calculate range including surrounding newlines
  let rangeFrom = openLine.from;
  let rangeTo = closeLine.to;

  // Include leading newline if present
  if (rangeFrom > 0) {
    rangeFrom--; // eat the \n before the opening fence
  }
  // Include trailing newline if present
  if (rangeTo < doc.length) {
    rangeTo++; // eat the \n after the closing fence
  }

  return { from: rangeFrom, to: rangeTo };
}

function handleDeleteKey(view: EditorView): boolean {
  const range = findDndCodeBlockRange(view);
  if (!range) return false;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: "" },
  });
  return true;
}

/**
 * CM6 keymap extension that enables Backspace/Delete to remove
 * entire D&D code blocks (monster, spell, item) when the cursor
 * is at or inside the block in Obsidian's editor.
 */
export const dndBlockDeleteKeymap = keymap.of([
  { key: "Backspace", run: handleDeleteKey },
  { key: "Delete", run: handleDeleteKey },
]);
