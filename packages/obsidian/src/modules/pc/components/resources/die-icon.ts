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
 * The face is a READOUT. Which face a resource shows is resolved from its
 * owner's class level by `resolveScalingDie`, so it is not the player's to pick
 * and there is nothing here to click or to persist.
 */

export interface DieIconOpts {
  /** `pc-die-lg` for the 44px face the counter components use inline. */
  size?: "sm" | "lg";
}

/** One masked die glyph. Returns the element so a caller can restyle its face. */
export function renderDieIcon(host: HTMLElement, face: string, opts: DieIconOpts = {}): HTMLElement {
  const normalized = face.trim().toLowerCase();
  const supportedFace = /^(?:1)?(d(?:4|6|8|10|12|20))$/.exec(normalized)?.[1] ?? normalized;
  const cls = ["pc-die-icon", `die-${supportedFace}`];
  if (opts.size === "lg") cls.splice(1, 0, "pc-die-lg");
  return host.createEl("i", { cls: cls.join(" "), attr: { "aria-hidden": "true" } });
}
