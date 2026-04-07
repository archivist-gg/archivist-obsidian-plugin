import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { setIcon } from "obsidian";
import { EntityRegistry, RegisteredEntity } from "../entities/entity-registry";

const TYPE_PREFIXES: Record<string, string> = {
  monster: "monster",
  spell: "spell",
  item: "magic-item",
  feat: "feat",
  condition: "condition",
  class: "class",
  background: "background",
  armor: "armor",
  weapon: "weapon",
};

const TYPE_ICONS: Record<string, string> = {
  monster: "swords",
  spell: "sparkles",
  "magic-item": "scroll-text",
  item: "scroll-text",
  feat: "star",
  condition: "alert-triangle",
  class: "shield",
  background: "book-open",
  armor: "shield",
  weapon: "sword",
};

export function detectCompendiumTrigger(
  line: string,
  cursorCh: number
): { start: number; query: string } | null {
  const textBefore = line.substring(0, cursorCh);
  const lastOpen = textBefore.lastIndexOf("{{");
  if (lastOpen === -1) return null;

  const afterOpen = textBefore.substring(lastOpen + 2);
  if (afterOpen.includes("}}")) return null;

  return { start: lastOpen, query: afterOpen };
}

export function adjustEndForBracketMatch(
  line: string,
  endCh: number
): number {
  return line.substring(endCh).startsWith("}}") ? endCh + 2 : endCh;
}

export class CompendiumEditorSuggest extends EditorSuggest<RegisteredEntity> {
  private registry: EntityRegistry;

  constructor(app: any, registry: EntityRegistry) {
    super(app);
    this.registry = registry;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const result = detectCompendiumTrigger(line, cursor.ch);
    if (!result) return null;

    return {
      start: { line: cursor.line, ch: result.start },
      end: cursor,
      query: result.query,
    };
  }

  getSuggestions(context: EditorSuggestContext): RegisteredEntity[] {
    const query = context.query;
    const colonIndex = query.indexOf(":");
    let entityType: string | undefined;
    let searchQuery: string;

    if (colonIndex !== -1) {
      const prefix = query.substring(0, colonIndex).toLowerCase();
      entityType = TYPE_PREFIXES[prefix];
      searchQuery = query.substring(colonIndex + 1).trim();
    } else {
      searchQuery = query.trim();
    }

    return this.registry.search(searchQuery, entityType, 20);
  }

  renderSuggestion(entity: RegisteredEntity, el: HTMLElement): void {
    const container = el.createDiv({ cls: "archivist-suggest-item" });

    const iconEl = container.createSpan({ cls: "archivist-suggest-icon" });
    setIcon(iconEl, TYPE_ICONS[entity.entityType] ?? "file-text");

    container.createSpan({ cls: "archivist-suggest-name", text: entity.name });

    container.createSpan({
      cls: "archivist-suggest-type",
      text: entity.entityType.replace("magic-", ""),
    });

    container.createSpan({
      cls: "archivist-suggest-compendium",
      text: entity.compendium,
    });
  }

  selectSuggestion(entity: RegisteredEntity, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const editor = this.context.editor;
    const start = this.context.start;
    const end = this.context.end;

    const line = editor.getLine(end.line);
    const adjustedEnd = {
      line: end.line,
      ch: adjustEndForBracketMatch(line, end.ch),
    };

    editor.replaceRange(`{{${entity.entityType}:${entity.slug}}}`, start, adjustedEnd);
  }
}
