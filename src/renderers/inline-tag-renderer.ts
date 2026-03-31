import { setIcon, Notice } from 'obsidian';
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
    span.setAttribute('title', `${config.format(tag.content)} -- Click to roll`);
    span.addEventListener('click', async () => {
      const api = (window as any).DiceRoller;
      if (api) {
        await api.parseDice(tag.content);
      } else {
        new Notice('Install the "Dice Roller" plugin from Community Plugins to roll dice.');
      }
    });
  }

  return span;
}
