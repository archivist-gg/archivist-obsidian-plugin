import { setIcon, Notice } from "obsidian";
import { parseInlineTag } from "../parsers/inline-tag-parser";
import { renderInlineTag } from "./inline-tag-renderer";
import type { MonsterAbilities } from "../types/monster";
import { detectFormula, resolveFormulaTag } from "../dnd/formula-tags";

/**
 * Optional monster context for resolving formula tags (e.g. `atk:DEX`) in view mode.
 * Only monster stat blocks provide this; spells, items, and standalone tags leave it undefined.
 */
export interface MonsterFormulaContext {
  abilities: MonsterAbilities;
  proficiencyBonus: number;
}

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
  roll: { iconName: "dices", cssClass: "archivist-stat-tag-dice", format: (c) => c, rollable: true },
  d: { iconName: "dices", cssClass: "archivist-stat-tag-dice", format: (c) => c, rollable: true },
  damage: { iconName: "dices", cssClass: "archivist-stat-tag-damage", format: (c) => c, rollable: true },
  atk: { iconName: "swords", cssClass: "archivist-stat-tag-atk", format: (c) => `${c} to hit`, rollable: true },
  dc: { iconName: "shield", cssClass: "archivist-stat-tag-dc", format: (c) => `DC ${c}`, rollable: false },
  mod: { iconName: "dices", cssClass: "archivist-stat-tag-dice", format: (c) => c, rollable: true },
  check: { iconName: "shield", cssClass: "archivist-stat-tag-dc", format: (c) => c, rollable: false },
};

/**
 * Convert an inline tag's content to a valid dice notation string for the Dice Roller API.
 * - dice: pass through as-is
 * - damage: strip trailing damage type text (e.g. "3d8 fire" -> "3d8")
 * - atk: convert modifier to d20 roll (e.g. "+7 to hit" -> "1d20+7")
 * - mod: convert modifier to d20 roll (e.g. "+5" -> "1d20+5")
 * Appends |render to force 3D dice rendering.
 */
export function extractDiceNotation(tag: { type: string; content: string }): string | null {
  switch (tag.type) {
    case "dice":
      return tag.content;
    case "damage": {
      const diceMatch = tag.content.match(/^([\dd+\-*/() ]+)/i);
      return diceMatch ? diceMatch[1].trim() : null;
    }
    case "atk":
    case "mod": {
      const modMatch = tag.content.match(/([+-]?\d+)/);
      return modMatch ? `1d20${modMatch[1].startsWith("-") || modMatch[1].startsWith("+") ? "" : "+"}${modMatch[1]}` : null;
    }
    default:
      return null;
  }
}

/**
 * Roll dice with 3D rendering.
 * Uses getRoller then roll(true) to force the 3D animation path.
 * A fresh roller has hasRunOnce=false, so shouldRender alone won't
 * trigger 3D — the explicit true argument bypasses that guard.
 */
export async function rollDiceWithRender(api: any, notation: string): Promise<void> {
  const roller = api.getRoller(notation, "", { shouldRender: true });
  if (roller) {
    await roller.roll(true);
  }
}

/**
 * Resolve formula content for a tag when monster context is available.
 * Returns the resolved content suitable for the tag's format function,
 * or the original content if no formula is detected or no context is provided.
 */
function resolveTagContent(
  tagType: string,
  content: string,
  monsterCtx?: MonsterFormulaContext,
): string {
  if (!monsterCtx) return content;
  const formula = detectFormula(tagType, content);
  if (!formula) return content;
  const resolved = resolveFormulaTag(tagType, content, monsterCtx.abilities, monsterCtx.proficiencyBonus);
  // resolveFormulaTag for dc returns "DC N" but STAT_TAG_CONFIGS.dc.format already prepends "DC ",
  // so strip the prefix to avoid "DC DC N".
  if (tagType === "dc" && resolved.startsWith("DC ")) {
    return resolved.slice(3);
  }
  return resolved;
}

/**
 * Render an inline tag for use inside stat blocks.
 * Displays Lucide icons, dashed underlines, and dispatches click-to-roll events
 * matching the Archivist app's parchment-themed annotation style.
 *
 * When monsterCtx is provided, formula tags (e.g. `atk:DEX`, `dc:WIS`, `damage:1d6+STR`)
 * are resolved to concrete values using the monster's ability scores and proficiency bonus.
 */
function renderStatBlockTag(
  tag: { type: string; content: string },
  monsterCtx?: MonsterFormulaContext,
): HTMLElement {
  const config = STAT_TAG_CONFIGS[tag.type];
  const span = document.createElement("span");

  if (!config) {
    span.textContent = tag.content;
    return span;
  }

  // Resolve formula tags (e.g. atk:DEX -> +4) when monster context is available
  const resolvedContent = resolveTagContent(tag.type, tag.content, monsterCtx);
  const resolvedTag = { type: tag.type, content: resolvedContent };

  span.addClasses(["archivist-stat-tag", config.cssClass]);

  const iconEl = document.createElement("span");
  iconEl.addClass("archivist-stat-tag-icon");
  setIcon(iconEl, config.iconName);
  span.appendChild(iconEl);

  const textEl = document.createElement("span");
  textEl.textContent = config.format(resolvedContent);
  span.appendChild(textEl);

  if (config.rollable) {
    span.setAttribute("data-dice-notation", resolvedContent);
    span.setAttribute("data-dice-type", tag.type);
    span.setAttribute("title", `${config.format(resolvedContent)} -- Click to roll`);
    span.addEventListener("click", async () => {
      const api = (window as any).DiceRoller;
      if (api) {
        const notation = extractDiceNotation(resolvedTag);
        if (notation) {
          try {
            await rollDiceWithRender(api, notation);
          } catch {
            new Notice(`Could not roll: ${resolvedContent}`);
          }
        }
      } else {
        new Notice('Install the "Dice Roller" plugin from Community Plugins to roll dice.');
      }
    });
  } else {
    span.setAttribute("title", config.format(resolvedContent));
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
    // Dice -> `roll:XdY+Z`
    .replace(/\{@dice\s+([^}]+)\}/gi, '`roll:$1`')
    .replace(/\{@d20\s+([^}]+)\}/gi, '`roll:d20$1`')
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
 * Append text to a parent element, parsing inline markdown into proper DOM elements.
 * Supports: ***bold italic***, **bold**, *italic*, _italic_, ~~strikethrough~~, [text](url)
 * Plain text without markdown is appended as regular text nodes.
 */
export function appendMarkdownText(text: string, parent: HTMLElement): void {
  const regex = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])|~~(.+?)~~|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[1] !== undefined) {
      const strong = document.createElement("strong");
      const em = document.createElement("em");
      em.textContent = match[1];
      strong.appendChild(em);
      parent.appendChild(strong);
    } else if (match[2] !== undefined) {
      const strong = document.createElement("strong");
      strong.textContent = match[2];
      parent.appendChild(strong);
    } else if (match[3] !== undefined) {
      const em = document.createElement("em");
      em.textContent = match[3];
      parent.appendChild(em);
    } else if (match[4] !== undefined) {
      const em = document.createElement("em");
      em.textContent = match[4];
      parent.appendChild(em);
    } else if (match[5] !== undefined) {
      const del = document.createElement("del");
      del.textContent = match[5];
      parent.appendChild(del);
    } else if (match[6] !== undefined) {
      const a = document.createElement("a");
      a.textContent = match[6];
      a.href = match[7];
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
      parent.appendChild(a);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/**
 * Render text that may contain inline tags like `roll:2d6+3` or `dc:15`.
 * Inside stat blocks, tags render as subtle inline text matching the parchment theme.
 * Outside stat blocks (body text), tags render as colorful pill badges.
 *
 * When monsterCtx is provided, formula tags (e.g. `atk:DEX`) are resolved to
 * concrete values. Only monster stat blocks should pass this parameter.
 */
export function renderTextWithInlineTags(
  text: string,
  parent: HTMLElement,
  statBlockMode = true,
  monsterCtx?: MonsterFormulaContext,
): void {
  // Convert any 5etools {@...} tags to backtick format before processing
  const converted = convert5eToolsTags(text);

  // Match backtick-wrapped tags: `type:content`
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(converted)) !== null) {
    // Append any plain text (with markdown) before this match
    if (match.index > lastIndex) {
      appendMarkdownText(converted.slice(lastIndex, match.index), parent);
    }

    const tagText = match[1];
    const parsed = parseInlineTag(tagText);
    if (parsed) {
      if (statBlockMode) {
        parent.appendChild(renderStatBlockTag(parsed, monsterCtx));
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

  // Append any remaining plain text (with markdown)
  if (lastIndex < converted.length) {
    appendMarkdownText(converted.slice(lastIndex), parent);
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
