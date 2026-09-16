import type { ResourceDie } from "@archivist-gg/dnd5e/types/resource";

/**
 * The die face, as a CSS-MASKED glyph.
 *
 * `.pc-die-icon` paints `currentColor` through a mask image, so a die reads as
 * the same ink as every other glyph on the sheet instead of a fixed-colour
 * picture — the artwork is in `styles/dice-icons.css`, one `.die-d4` … `.die-d20`
 * rule per face (dice by Lonnie Tapscott via Noun Project, CC BY 3.0; see
 * `CREDITS.md`). A face with no mask rule renders an empty box rather than a
 * broken image, which is why the element is unconditional and the face class is
 * the only variable.
 *
 * ⚠️ Stepping is DOM-LOCAL and does not persist. The shipped engine carries no
 * field to record a chosen rung (`die.scaling` is keyed by LEVEL and resolved
 * automatically by `resolveScalingDie`), so a step survives until the next sheet
 * re-render — which any `editState` write triggers — and then re-reads the
 * level-resolved face. Nothing is written to the character file.
 */

/** The polyhedral ramp, in ascending order. Faces outside it keep their authored
 *  order after the known ones (a homebrew d3 or d100 is not dropped). */
const DIE_ORDER = ["d4", "d6", "d8", "d10", "d12", "d20"] as const;

/** Every face the resource can show, ascending: `die.base` plus every value of
 *  `die.scaling`, de-duped. The ladder is the resource's OWN vocabulary — a face
 *  the feature never declares is unreachable, which is the point of reading it
 *  off the data rather than hardcoding d4→d20 here. */
export function dieLadder(die: ResourceDie): string[] {
  const seen = new Set<string>([die.base, ...Object.values(die.scaling ?? {})]);
  const known = DIE_ORDER.filter((d) => seen.has(d));
  const rest = [...seen].filter((d) => !(DIE_ORDER as readonly string[]).includes(d));
  return [...known, ...rest];
}

export interface DieIconOpts {
  /** `pc-die-lg` for the 40px face the counter components use inline. */
  size?: "sm" | "lg";
}

/** One masked die glyph. Returns the element so a caller can restyle its face. */
export function renderDieIcon(host: HTMLElement, face: string, opts: DieIconOpts = {}): HTMLElement {
  const cls = ["pc-die-icon", `die-${face}`];
  if (opts.size === "lg") cls.splice(1, 0, "pc-die-lg");
  return host.createEl("i", { cls: cls.join(" "), attr: { "aria-hidden": "true" } });
}

/** Repoint an existing icon at another face, dropping only the face class. */
export function setDieIconFace(icon: HTMLElement, face: string): void {
  // `Array.from` over the live list, not a spread: the repo's TS lib target has
  // no iterator on `DOMTokenList`, and removing from a live list while walking it
  // would skip entries anyway.
  for (const c of Array.from(icon.classList)) if (/^die-d\d+$/.test(c)) icon.classList.remove(c);
  icon.classList.add(`die-${face}`);
}
