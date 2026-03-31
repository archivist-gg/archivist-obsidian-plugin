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
    const lastBracket = textBefore.lastIndexOf('[[');
    if (lastBracket === -1) return null;
    const afterBrackets = textBefore.substring(lastBracket + 2);
    if (afterBrackets.includes(']]')) return null;
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
    editor.replaceRange(`[[${entity.name}]]`, start, end);
  }
}
