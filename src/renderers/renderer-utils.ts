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
 * Render text that may contain inline tags like `dice:2d6+3` or `dc:15`.
 * Plain text is rendered as text nodes; backtick-wrapped tags become inline
 * tag elements.
 */
export function renderTextWithInlineTags(
  text: string,
  parent: HTMLElement,
): void {
  // Match backtick-wrapped tags: `type:content`
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Append any plain text before this match
    if (match.index > lastIndex) {
      parent.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
    }

    const tagText = match[1];
    const parsed = parseInlineTag(tagText);
    if (parsed) {
      parent.appendChild(renderInlineTag(parsed));
    } else {
      // Not a valid tag, render as code
      const code = document.createElement("code");
      code.textContent = tagText;
      parent.appendChild(code);
    }

    lastIndex = regex.lastIndex;
  }

  // Append any remaining plain text
  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
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
