import { setIcon } from "obsidian";
import { parseInlineTag } from "../parsers/inline-tag-parser";
import { renderInlineTag } from "./inline-tag-renderer";
import { formatDiceTooltip } from "../dice/diceStats";

interface ElOptions {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string>;
  parent?: HTMLElement;
}

export function el(tag: string, opts?: ElOptions): HTMLElement {
  const element = document.createElement(tag);
  if (opts) {
    if (opts.cls) {
      if (Array.isArray(opts.cls)) {
        element.addClasses(opts.cls);
      } else {
        element.addClass(opts.cls);
      }
    }
    if (opts.text) {
      element.textContent = opts.text;
    }
    if (opts.attr) {
      for (const [key, value] of Object.entries(opts.attr)) {
        element.setAttribute(key, value);
      }
    }
    if (opts.parent) {
      opts.parent.appendChild(element);
    }
  }
  return element;
}

export function createSvgBar(parent: HTMLElement): SVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "stat-block-bar");
  svg.setAttribute("height", "5");
  svg.setAttribute("width", "100%");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("viewBox", "0 0 400 5");

  const polyline = document.createElementNS(ns, "polyline");
  polyline.setAttribute("points", "0,0 400,2.5 0,5");
  svg.appendChild(polyline);

  parent.appendChild(svg);
  return svg;
}

export function createPropertyLine(
  parent: HTMLElement,
  label: string,
  value: string,
  isLast?: boolean,
): HTMLElement {
  const line = el("div", {
    cls: isLast ? ["property-line", "last"] : "property-line",
    parent,
  });
  el("h4", { text: label, parent: line });
  el("p", { text: value, parent: line });
  return line;
}

export function createIconProperty(
  parent: HTMLElement,
  iconName: string,
  label: string,
  value: string,
): HTMLElement {
  const line = el("div", { cls: "archivist-property-line-icon", parent });

  const iconSpan = el("span", { cls: "archivist-property-icon", parent: line });
  setIcon(iconSpan, iconName);

  el("span", { cls: "archivist-property-label", text: label, parent: line });
  el("span", { cls: "archivist-property-value", text: value, parent: line });

  return line;
}

/**
 * Configuration for stat block inline tag rendering.
 * Each tag type maps to an icon, CSS class, display formatter, and rollability.
 */
interface StatTagConfig {
  iconName: string;
  cssClass: string;
  format: (content: string) => string;
  rollable: boolean;
}

const STAT_TAG_CONFIGS: Record<string, StatTagConfig> = {
  dice: { iconName: "dices", cssClass: "archivist-stat-tag-dice", format: (c) => c, rollable: true },
  damage: { iconName: "dices", cssClass: "archivist-stat-tag-damage", format: (c) => c, rollable: true },
  atk: { iconName: "swords", cssClass: "archivist-stat-tag-atk", format: (c) => `${c} to hit`, rollable: true },
  dc: { iconName: "shield", cssClass: "archivist-stat-tag-dc", format: (c) => `DC ${c}`, rollable: false },
  mod: { iconName: "dices", cssClass: "archivist-stat-tag-dice", format: (c) => c, rollable: true },
  check: { iconName: "shield", cssClass: "archivist-stat-tag-dc", format: (c) => c, rollable: false },
};

/**
 * Render an inline tag for use inside stat blocks.
 * Displays Lucide icons, dashed underlines, and dispatches click-to-roll events
 * matching the Archivist app's parchment-themed annotation style.
 */
function renderStatBlockTag(tag: { type: string; content: string }): HTMLElement {
  const config = STAT_TAG_CONFIGS[tag.type];
  const span = document.createElement("span");

  if (!config) {
    span.textContent = tag.content;
    return span;
  }

  span.addClasses(["archivist-stat-tag", config.cssClass]);

  const iconEl = document.createElement("span");
  iconEl.addClass("archivist-stat-tag-icon");
  setIcon(iconEl, config.iconName);
  span.appendChild(iconEl);

  const textEl = document.createElement("span");
  textEl.textContent = config.format(tag.content);
  span.appendChild(textEl);

  if (config.rollable) {
    span.setAttribute("data-dice-notation", tag.content);
    span.setAttribute("data-dice-type", tag.type);
    span.setAttribute("title", formatDiceTooltip(tag.content));
    span.addEventListener("click", () => {
      span.dispatchEvent(new CustomEvent("archivist-dice-roll", {
        bubbles: true,
        detail: { notation: tag.content, type: tag.type },
      }));
    });
  } else {
    span.setAttribute("title", config.format(tag.content));
  }

  return span;
}

/**
 * Convert 5etools-style {@...} tags to the plugin's backtick inline-tag format.
 * Called before backtick regex processing so AI-generated 5etools markup renders correctly.
 */
export function convert5eToolsTags(text: string): string {
  return text
    // Attack type labels (order matters: compound first)
    .replace(/\{@atk\s+mw,rw\}/gi, 'Melee or Ranged Weapon Attack:')
    .replace(/\{@atk\s+mws\}/gi, 'Melee or Ranged Weapon Attack:')
    .replace(/\{@atk\s+msw\}/gi, 'Melee or Ranged Spell Attack:')
    .replace(/\{@atk\s+mw\}/gi, 'Melee Weapon Attack:')
    .replace(/\{@atk\s+rw\}/gi, 'Ranged Weapon Attack:')
    .replace(/\{@atk\s+ms\}/gi, 'Melee Spell Attack:')
    .replace(/\{@atk\s+rs\}/gi, 'Ranged Spell Attack:')
    // Hit bonus -> `atk:+N`
    .replace(/\{@hit\s+(\d+)\}/gi, '`atk:+$1`')
    // Hit label
    .replace(/\{@h\}/gi, 'Hit:')
    // Damage -> `damage:XdY+Z type`
    .replace(/\{@damage\s+([^}]+)\}/gi, '`damage:$1`')
    // Dice -> `dice:XdY+Z`
    .replace(/\{@dice\s+([^}]+)\}/gi, '`dice:$1`')
    .replace(/\{@d20\s+([^}]+)\}/gi, '`dice:d20$1`')
    // DC -> `dc:N`
    .replace(/\{@dc\s+(\d+)\}/gi, '`dc:$1`')
    // Recharge -> "(Recharge X-6)" or "(Recharge)"
    .replace(/\{@recharge\s+(\d)\}/gi, '(Recharge $1-6)')
    .replace(/\{@recharge\}/gi, '(Recharge)')
    // Chance -> "N% chance"
    .replace(/\{@chance\s+(\d+)\}/gi, '$1% chance')
    // Formatting
    .replace(/\{@b(?:old)?\s+([^}]+)\}/gi, '**$1**')
    .replace(/\{@i(?:talic)?\s+([^}]+)\}/gi, '_$1_')
    .replace(/\{@s(?:trike)?\s+([^}]+)\}/gi, '~~$1~~')
    .replace(/\{@note\s+([^}]+)\}/gi, '($1)')
    // Entity references -- extract display name (first part before |)
    .replace(/\{@spell\s+([^|}]+)[^}]*\}/gi, '_$1_')
    .replace(/\{@item\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@creature\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@condition\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@skill\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@sense\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@action\s+([^|}]+)[^}]*\}/gi, '**$1**')
    .replace(/\{@status\s+([^|}]+)[^}]*\}/gi, '**$1**')
    .replace(/\{@ability\s+([^|}]+)[^}]*\}/gi, '**$1**')
    .replace(/\{@class\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@feat\s+([^|}]+)[^}]*\}/gi, '**$1**')
    .replace(/\{@background\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@race\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@disease\s+([^|}]+)[^}]*\}/gi, '**$1**')
    .replace(/\{@hazard\s+([^|}]+)[^}]*\}/gi, '**$1**')
    .replace(/\{@plane\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@language\s+([^|}]+)[^}]*\}/gi, '$1')
    .replace(/\{@book\s+([^|}]+)[^}]*\}/gi, '_$1_')
    .replace(/\{@adventure\s+([^|}]+)[^}]*\}/gi, '_$1_')
    // Catch-all: any remaining {@tag content} -> just content
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

/**
 * Render text that may contain inline tags like `dice:2d6+3` or `dc:15`.
 * Inside stat blocks, tags render as subtle inline text matching the parchment theme.
 * Outside stat blocks (body text), tags render as colorful pill badges.
 */
export function renderTextWithInlineTags(
  text: string,
  parent: HTMLElement,
  statBlockMode = true,
): void {
  // Convert any 5etools {@...} tags to backtick format before processing
  const converted = convert5eToolsTags(text);

  // Match backtick-wrapped tags: `type:content`
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(converted)) !== null) {
    // Append any plain text before this match
    if (match.index > lastIndex) {
      parent.appendChild(
        document.createTextNode(converted.slice(lastIndex, match.index)),
      );
    }

    const tagText = match[1];
    const parsed = parseInlineTag(tagText);
    if (parsed) {
      if (statBlockMode) {
        parent.appendChild(renderStatBlockTag(parsed));
      } else {
        parent.appendChild(renderInlineTag(parsed));
      }
    } else {
      // Not a valid tag, render as code
      const code = document.createElement("code");
      code.textContent = tagText;
      parent.appendChild(code);
    }

    lastIndex = regex.lastIndex;
  }

  // Append any remaining plain text
  if (lastIndex < converted.length) {
    parent.appendChild(document.createTextNode(converted.slice(lastIndex)));
  }
}

export function createErrorBlock(
  error: string,
  rawSource: string,
): HTMLElement {
  const block = el("div", { cls: "archivist-error-block" });

  const banner = el("div", { cls: "archivist-error-banner", parent: block });
  const iconSpan = el("span", { cls: "archivist-error-icon", parent: banner });
  setIcon(iconSpan, "alert-triangle");
  el("span", { text: error, parent: banner });

  el("pre", {
    cls: "archivist-error-source",
    text: rawSource,
    parent: block,
  });

  return block;
}
