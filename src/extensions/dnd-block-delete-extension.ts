import { syntaxTree } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

const DND_LANGUAGES = new Set(["monster", "spell", "item"]);

function findDndCodeBlockRange(
  view: EditorView,
): { from: number; to: number } | null {
  const { state } = view;
  const { from, to } = state.selection.main;
  let blockRange: { from: number; to: number } | null = null;

  syntaxTree(state).iterate({
    from: Math.max(0, from - 1),
    to: Math.min(state.doc.length, to + 1),
    enter(node) {
      if (blockRange) return false;
      if (!node.type.name.includes("FencedCode")) return;

      const blockStart = state.doc.sliceString(
        node.from,
        Math.min(node.from + 30, node.to),
      );
      const langMatch = blockStart.match(/^```(\w+)/);
      if (!langMatch || !DND_LANGUAGES.has(langMatch[1])) return;

      const isAtBefore = from >= node.from - 1 && from <= node.from + 1;
      const isAtAfter = from >= node.to - 1 && from <= node.to + 1;
      const isOverlapping = from <= node.to && to >= node.from;

      if (isAtBefore || isAtAfter || isOverlapping) {
        let rangeFrom = node.from;
        let rangeTo = node.to;
        if (
          rangeFrom > 0 &&
          state.doc.sliceString(rangeFrom - 1, rangeFrom) === "\n"
        )
          rangeFrom--;
        if (
          rangeTo < state.doc.length &&
          state.doc.sliceString(rangeTo, rangeTo + 1) === "\n"
        )
          rangeTo++;
        blockRange = { from: rangeFrom, to: rangeTo };
      }
    },
  });
  return blockRange;
}

function handleDeleteKey(view: EditorView): boolean {
  const range = findDndCodeBlockRange(view);
  if (!range) return false;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: "" },
  });
  return true;
}

export const dndBlockDeleteKeymap = keymap.of([
  { key: "Backspace", run: handleDeleteKey },
  { key: "Delete", run: handleDeleteKey },
]);
