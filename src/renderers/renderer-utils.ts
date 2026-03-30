import { setIcon } from "obsidian";
import { parseInlineTag } from "../parsers/inline-tag-parser";
import { renderInlineTag } from "./inline-tag-renderer";

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
 * Render a tag as subtle inline text for use inside stat blocks.
 * Matches archivist's dnd-formatted-text style: plain text colored to
 * match the parchment theme, no pill badges.
 */
function renderStatBlockTag(tag: { type: string; content: string }): HTMLElement {
  const span = document.createElement("span");

  switch (tag.type) {
    case "atk":
      // Attack: italic, accent color, e.g. "+4 to hit"
      span.addClass("archivist-stat-inline-atk");
      span.textContent = `${tag.content} to hit`;
      break;
    case "damage":
      // Damage: normal weight, dark text, e.g. "1d6+2 slashing"
      span.addClass("archivist-stat-inline-dice");
      span.textContent = tag.content;
      break;
    case "dice":
      // Dice roll: normal weight, dark text
      span.addClass("archivist-stat-inline-dice");
      span.textContent = tag.content;
      break;
    case "dc":
      // DC: normal weight, e.g. "DC 15"
      span.addClass("archivist-stat-inline-dc");
      span.textContent = `DC ${tag.content}`;
      break;
    case "mod":
      span.addClass("archivist-stat-inline-dice");
      span.textContent = tag.content;
      break;
    case "check":
      span.addClass("archivist-stat-inline-dc");
      span.textContent = tag.content;
      break;
    default:
      span.textContent = tag.content;
  }

  return span;
}

/**
 * Convert 5etools-style {@...} tags to the plugin's backtick inline-tag format.
 * Called before backtick regex processing so AI-generated 5etools markup renders correctly.
 */
export function convert5eToolsTags(text: string): string {
  return text
    // Attack type labels
    .replace(/\{@atk\s+mw,rw\}/gi, 'Melee or Ranged Weapon Attack:')
    .replace(/\{@atk\s+mw\}/gi, 'Melee Weapon Attack:')
    .replace(/\{@atk\s+rw\}/gi, 'Ranged Weapon Attack:')
    // Hit bonus -> `atk:+N`
    .replace(/\{@hit\s+(\d+)\}/gi, '`atk:+$1`')
    // Hit label
    .replace(/\{@h\}/gi, 'Hit:')
    // Damage -> `damage:XdY+Z type`
    .replace(/\{@damage\s+([^}]+)\}/gi, '`damage:$1`')
    // Dice -> `dice:XdY+Z`
    .replace(/\{@dice\s+([^}]+)\}/gi, '`dice:$1`')
    // DC -> `dc:N`
    .replace(/\{@dc\s+(\d+)\}/gi, '`dc:$1`')
    // Condition -> plain text
    .replace(/\{@condition\s+([^}]+)\}/gi, '$1')
    // Spell -> italicized plain text
    .replace(/\{@spell\s+([^}]+)\}/gi, '_$1_');
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
