/**
 * Shared layout helpers for sheet popovers (conditions, defenses, etc.).
 *
 * Popovers are rendered into `document.body` rather than the sheet root, so
 * they need explicit viewport-clamping to stay visible — the parent sheet's
 * container query and overflow don't help once the popover is portal'd out.
 */

/**
 * Nudge `popover` so it stays inside the viewport. Call AFTER setting the
 * initial top/left from the anchor's `getBoundingClientRect()`. Behaviour:
 *
 * - If the popover spills past the right edge, shift left by the overflow.
 * - Then re-check the left edge — if shifting pushed it off the left,
 *   nudge it back so a `margin` px gap remains.
 * - If the popover spills past the bottom, try repositioning above the
 *   anchor; failing that, pin to `viewH - height - margin`.
 *
 * Does not flip above when there's room below. Does not animate.
 */
export function clampPopoverToViewport(popover: HTMLElement, anchorRect: DOMRect): void {
  const margin = 8;
  const viewW = activeWindow.innerWidth;
  const viewH = activeWindow.innerHeight;
  const popRect = popover.getBoundingClientRect();

  if (popRect.right > viewW - margin) {
    const shift = popRect.right - (viewW - margin);
    popover.style.left = `${parseFloat(popover.style.left) - shift}px`;
  }
  const afterHorizontal = popover.getBoundingClientRect();
  if (afterHorizontal.left < margin) {
    popover.style.left = `${parseFloat(popover.style.left) + (margin - afterHorizontal.left)}px`;
  }

  if (popRect.bottom > viewH - margin) {
    const aboveTop = anchorRect.top - popRect.height - 4;
    if (aboveTop >= margin) {
      popover.style.top = `${aboveTop + activeWindow.scrollY}px`;
    } else {
      const clampedTop = Math.max(margin, viewH - popRect.height - margin);
      popover.style.top = `${clampedTop + activeWindow.scrollY}px`;
    }
  }
}
