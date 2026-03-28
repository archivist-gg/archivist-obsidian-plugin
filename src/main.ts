import { Plugin } from "obsidian";
import { parseMonster } from "./parsers/monster-parser";
import { parseSpell } from "./parsers/spell-parser";
import { parseItem } from "./parsers/item-parser";
import { parseInlineTag } from "./parsers/inline-tag-parser";
import { renderMonsterBlock } from "./renderers/monster-renderer";
import { renderSpellBlock } from "./renderers/spell-renderer";
import { renderItemBlock } from "./renderers/item-renderer";
import { renderInlineTag } from "./renderers/inline-tag-renderer";
import { createErrorBlock } from "./renderers/renderer-utils";
import { MonsterModal } from "./modals/monster-modal";
import { SpellModal } from "./modals/spell-modal";
import { ItemModal } from "./modals/item-modal";
import { inlineTagPlugin } from "./extensions/inline-tag-extension";

export default class ArchivistPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("monster", (source, el) => {
      this.renderBlock(source, el, parseMonster, renderMonsterBlock);
    });

    this.registerMarkdownCodeBlockProcessor("spell", (source, el) => {
      this.renderBlock(source, el, parseSpell, renderSpellBlock);
    });

    this.registerMarkdownCodeBlockProcessor("item", (source, el) => {
      this.renderBlock(source, el, parseItem, renderItemBlock);
    });

    this.registerMarkdownPostProcessor((element) => {
      const codeElements = element.querySelectorAll("code");
      codeElements.forEach((codeEl) => {
        const text = codeEl.textContent ?? "";
        const parsed = parseInlineTag(text);
        if (parsed) {
          const tagEl = renderInlineTag(parsed);
          codeEl.replaceWith(tagEl);
        }
      });
    });

    this.registerEditorExtension(inlineTagPlugin);

    this.addCommand({
      id: "insert-monster",
      name: "Insert Monster Block",
      editorCallback: (editor) => {
        new MonsterModal(this.app, editor).open();
      },
    });

    this.addCommand({
      id: "insert-spell",
      name: "Insert Spell Block",
      editorCallback: (editor) => {
        new SpellModal(this.app, editor).open();
      },
    });

    this.addCommand({
      id: "insert-item",
      name: "Insert Magic Item Block",
      editorCallback: (editor) => {
        new ItemModal(this.app, editor).open();
      },
    });
  }

  private renderBlock<T>(
    source: string,
    el: HTMLElement,
    parser: (
      source: string,
    ) => { success: true; data: T } | { success: false; error: string },
    renderer: (data: T) => HTMLElement,
  ): void {
    const result = parser(source);
    if (result.success) {
      el.appendChild(renderer(result.data));
    } else {
      el.appendChild(createErrorBlock(result.error, source));
    }
  }

  onunload() {}
}
