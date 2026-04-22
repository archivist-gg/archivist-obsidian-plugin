import { setIcon, Notice } from 'obsidian';
import { InlineTag, InlineTagType } from '../parsers/inline-tag-parser';
import { extractDiceNotation, rollDiceWithRender } from './renderer-utils';

interface InlineTagConfig {
  iconName: string;
  cssClass: string;
  format: (content: string) => string;
  rollable: boolean;
}

// Parser aliases 'roll' and 'd' to 'dice', so we don't expect them at runtime,
// but keep entries here defensively.
type InlineTagConfigKey = InlineTagType | 'roll' | 'd';

const INLINE_TAG_CONFIGS: Record<InlineTagConfigKey, InlineTagConfig> = {
  dice: { iconName: 'dices', cssClass: 'archivist-tag-dice', format: (c: string) => c, rollable: true },
  roll: { iconName: 'dices', cssClass: 'archivist-tag-dice', format: (c: string) => c, rollable: true },
  d: { iconName: 'dices', cssClass: 'archivist-tag-dice', format: (c: string) => c, rollable: true },
  damage: { iconName: 'dices', cssClass: 'archivist-tag-damage', format: (c: string) => c, rollable: true },
  dc: { iconName: 'shield', cssClass: 'archivist-tag-dc', format: (c: string) => `DC ${c}`, rollable: false },
  atk: { iconName: 'swords', cssClass: 'archivist-tag-atk', format: (c: string) => `${c} to hit`, rollable: true },
  mod: { iconName: 'dices', cssClass: 'archivist-tag-dice', format: (c: string) => c, rollable: true },
  check: { iconName: 'shield', cssClass: 'archivist-tag-dc', format: (c: string) => c, rollable: false },
};

export function renderInlineTag(tag: InlineTag, doc: Document = activeDocument): HTMLElement {
  const config = INLINE_TAG_CONFIGS[tag.type];

  const span = doc.createElement('span');
  span.addClasses(['archivist-tag', config.cssClass]);

  const iconEl = doc.createElement('span');
  iconEl.addClass('archivist-tag-icon');
  setIcon(iconEl, config.iconName);
  span.appendChild(iconEl);

  const textEl = doc.createElement('span');
  textEl.textContent = config.format(tag.content);
  span.appendChild(textEl);

  if (config.rollable) {
    span.setAttribute('data-dice-notation', tag.content);
    span.setAttribute('data-dice-type', tag.type);
    span.setAttribute('title', `${config.format(tag.content)} -- Click to roll`);
    span.addEventListener('click', () => {
      void (async () => {
        const api = (span.win as unknown as { DiceRoller?: unknown }).DiceRoller;
        if (api) {
          const notation = extractDiceNotation(tag);
          if (notation) {
            try {
              await rollDiceWithRender(api, notation);
            } catch {
              new Notice(`Could not roll: ${tag.content}`);
            }
          }
        } else {
          new Notice('Install the "dice roller" plugin from community plugins to roll dice.');
        }
      })();
    });
  }

  return span;
}
