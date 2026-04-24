/**
 * Condition icons for the PC conditions popover.
 *
 * **These are placeholder SVGs.** Final art should be sourced from
 * game-icons.net (CC-BY 3.0, https://creativecommons.org/licenses/by/3.0/)
 * — see the TODO on each icon for the suggested final-art slug. See
 * `CREDITS.md` at the repo root for attribution when real art lands.
 *
 * Mounting uses `DOMParser`, not `innerHTML`, to avoid the XSS anti-pattern.
 * Since these are bundled static assets the distinction is theoretical, but
 * the DOMParser-based path is correct by default.
 */

import type { ConditionSlug } from "../constants/conditions";

// Each SVG is a simple geometric placeholder. Distinct shapes per condition
// so that the popover UI in Task 14 can be visually reviewed even before the
// final game-icons.net art lands.

// TODO(SP4 icons): replace with game-icons.net/lorc/blindfold (CC-BY 3.0)
const BLINDED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="10" width="20" height="4" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/hearts (CC-BY 3.0)
const CHARMED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6-8 11-8 11z" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/ear-plugs (CC-BY 3.0)
const DEAFENED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M6 18 L18 6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/screaming (CC-BY 3.0)
const FRIGHTENED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><ellipse cx="12" cy="16" rx="2" ry="3" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/manacles (CC-BY 3.0)
const GRAPPLED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="2"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/knocked-out (CC-BY 3.0)
const INCAPACITATED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20c4-4 12-4 16 0" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><text x="12" y="13" text-anchor="middle" font-size="6" fill="currentColor">zzz</text></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/ghost-ally (CC-BY 3.0)
const INVISIBLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 L20 20 M4 20 L20 4" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="2 2"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/lightning-tear (CC-BY 3.0)
const PARALYZED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 L6 13 L12 13 L11 22 L18 11 L12 11 Z" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/stone-block (CC-BY 3.0)
const PETRIFIED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1" fill="currentColor"/><line x1="3" y1="12" x2="21" y2="12" stroke="white" stroke-width="1"/><line x1="9" y1="5" x2="9" y2="12" stroke="white" stroke-width="1"/><line x1="15" y1="12" x2="15" y2="19" stroke="white" stroke-width="1"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/death-juice (CC-BY 3.0)
const POISONED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 C8 9 6 13 6 16 a6 6 0 0 0 12 0 C18 13 16 9 12 3 Z" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/prostration (CC-BY 3.0)
const PRONE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="14" width="20" height="3" fill="currentColor"/><circle cx="5" cy="12" r="2" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/ball-shackle (CC-BY 3.0)
const RESTRAINED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="16" r="5" fill="currentColor"/><line x1="11" y1="12" x2="19" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/><rect x="18" y="3" width="3" height="3" fill="currentColor"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/dizzy (CC-BY 3.0)
const STUNNED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10 Q8 6 12 10 T20 10 M4 14 Q8 10 12 14 T20 14" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/sleepy (CC-BY 3.0)
const UNCONSCIOUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><text x="6" y="10" font-size="6" fill="currentColor">z</text><text x="10" y="14" font-size="8" fill="currentColor">z</text><text x="14" y="20" font-size="10" fill="currentColor">Z</text></svg>`;

// TODO(SP4 icons): replace with game-icons.net/lorc/tired-eye (CC-BY 3.0)
export const EXHAUSTION_ICON: string = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12 Q12 5 21 12 Q12 19 3 12 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/><line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="1"/></svg>`;

export const CONDITION_ICONS: Record<ConditionSlug, string> = {
  blinded: BLINDED_SVG,
  charmed: CHARMED_SVG,
  deafened: DEAFENED_SVG,
  frightened: FRIGHTENED_SVG,
  grappled: GRAPPLED_SVG,
  incapacitated: INCAPACITATED_SVG,
  invisible: INVISIBLE_SVG,
  paralyzed: PARALYZED_SVG,
  petrified: PETRIFIED_SVG,
  poisoned: POISONED_SVG,
  prone: PRONE_SVG,
  restrained: RESTRAINED_SVG,
  stunned: STUNNED_SVG,
  unconscious: UNCONSCIOUS_SVG,
};

/**
 * Parse an SVG string into a DOM node via DOMParser (not innerHTML) and
 * append it to `el`. The SVG is mounted as a real child node; `el` gets
 * the `pc-cond-icon` class and `aria-hidden="true"`.
 */
function mountSvg(el: HTMLElement, svgString: string): void {
  while (el.firstChild) el.removeChild(el.firstChild);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.documentElement;
  // Guard: if parsing failed, `documentElement` is a <parsererror>. Skip mount.
  if (svg.tagName.toLowerCase() !== "svg") return;
  el.appendChild(svg);
  el.classList.add("pc-cond-icon");
  el.setAttribute("aria-hidden", "true");
}

export function setConditionIcon(el: HTMLElement, slug: ConditionSlug): void {
  mountSvg(el, CONDITION_ICONS[slug]);
}

export function setExhaustionIcon(el: HTMLElement): void {
  mountSvg(el, EXHAUSTION_ICON);
}
