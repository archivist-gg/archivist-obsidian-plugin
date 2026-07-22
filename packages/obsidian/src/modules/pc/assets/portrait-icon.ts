/**
 * d20 placeholder icon shown in the header avatar button before a portrait
 * is set. Mounted via `DOMParser`, same pattern as `spell-icons.ts`.
 *
 * Deviates from that file's `mountSvg` on purpose: the CSS sizing selector
 * (`svg.pc-avatar-icon`) targets the `<svg>` element itself, not the host,
 * so the class/aria-hidden are set on the svg, not the wrapping button.
 */
const D20_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12,2.5 20.2,7.25 20.2,16.75 12,21.5 3.8,16.75 3.8,7.25"/><polygon points="6.9,8.7 17.1,8.7 12,17.7"/><path d="M12 2.5 L6.9 8.7 M12 2.5 L17.1 8.7 M3.8 7.25 L6.9 8.7 M20.2 7.25 L17.1 8.7 M3.8 16.75 L6.9 8.7 M3.8 16.75 L12 17.7 M20.2 16.75 L17.1 8.7 M20.2 16.75 L12 17.7 M12 21.5 L12 17.7"/></svg>`;

/** Mount the d20 default-portrait icon into `el`. Clears `el` first. */
export function setPortraitPlaceholderIcon(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
  const parser = new DOMParser();
  const doc = parser.parseFromString(D20_SVG, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== "svg") return;
  svg.classList.add("pc-avatar-icon");
  svg.setAttribute("aria-hidden", "true");
  el.appendChild(svg);
}
