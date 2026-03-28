import { setIcon } from "obsidian";
import { InlineTag, InlineTagType } from "../parsers/inline-tag-parser";

interface TagConfig {
  iconName: string;
  cssClass: string;
  format: (content: string) => string;
}

const TAG_CONFIGS: Record<InlineTagType, TagConfig> = {
  dice: {
    iconName: "dices",
    cssClass: "archivist-tag-dice",
    format: (c) => c,
  },
  damage: {
    iconName: "dices",
    cssClass: "archivist-tag-damage",
    format: (c) => c,
  },
  dc: {
    iconName: "shield",
    cssClass: "archivist-tag-dc",
    format: (c) => `DC ${c}`,
  },
  atk: {
    iconName: "swords",
    cssClass: "archivist-tag-atk",
    format: (c) => `${c} to hit`,
  },
  mod: {
    iconName: "plus-minus",
    cssClass: "archivist-tag-mod",
    format: (c) => c,
  },
  check: {
    iconName: "shield-check",
    cssClass: "archivist-tag-check",
    format: (c) => c,
  },
};

export function renderInlineTag(tag: InlineTag): HTMLElement {
  const config = TAG_CONFIGS[tag.type];

  const span = document.createElement("span");
  span.addClasses(["archivist-tag", config.cssClass]);

  const iconSpan = document.createElement("span");
  iconSpan.addClass("archivist-tag-icon");
  setIcon(iconSpan, config.iconName);
  span.appendChild(iconSpan);

  const contentSpan = document.createElement("span");
  contentSpan.addClass("archivist-tag-content");
  contentSpan.textContent = config.format(tag.content);
  span.appendChild(contentSpan);

  return span;
}
