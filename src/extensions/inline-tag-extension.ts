import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { parseInlineTag } from "../shared/rendering/inline-tag-parser";
import { renderInlineTag } from "../shared/rendering/inline-tag-renderer";

class InlineTagWidget extends WidgetType {
  constructor(private tagText: string) {
    super();
  }

  toDOM(): HTMLElement {
    const parsed = parseInlineTag(this.tagText);
    if (parsed) {
      return renderInlineTag(parsed);
    }
    const code = activeDocument.createElement("code");
    code.textContent = this.tagText;
    return code;
  }

  eq(other: InlineTagWidget): boolean {
    return this.tagText === other.tagText;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (
          node.type.name.includes("inline-code") ||
          node.type.name.includes("InlineCode")
        ) {
          const text = view.state.doc.sliceString(node.from, node.to);
          const content =
            text.startsWith("`") && text.endsWith("`")
              ? text.slice(1, -1)
              : text;

          const parsed = parseInlineTag(content);
          if (parsed) {
            builder.add(
              node.from,
              node.to,
              Decoration.replace({
                widget: new InlineTagWidget(content),
              }),
            );
          }
        }
      },
    });
  }

  return builder.finish();
}

export const inlineTagPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
