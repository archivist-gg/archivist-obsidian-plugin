/** Horizontal clamp for the shared `.pc-pop` parchment popovers (class-card
 *  level picker A-II, abilities Base picker B-II). Panels position `absolute`
 *  inside their anchor; near a container edge they can spill past the nearest
 *  clipping/visual bound — the class card crops via `overflow: hidden`, so a
 *  198px panel opening from the right-edge Lv pill gets cut. After the panel
 *  mounts, measure and shift it back inside via margin-left, counter-shifting
 *  the caret so it stays centred on the trigger. */
const CLAMP_MARGIN = 8;

/** Pure math: how far to shift a panel spanning [left, right] so it sits within
 *  [boundLeft, boundRight] with `margin` slack. When the bounds are narrower
 *  than the panel, pinning the left edge wins (titles read from the left). */
export function clampDx(left: number, right: number, boundLeft: number, boundRight: number, margin = CLAMP_MARGIN): number {
  let dx = 0;
  if (right > boundRight - margin) dx = boundRight - margin - right;
  if (left + dx < boundLeft + margin) dx = boundLeft + margin - left;
  return dx;
}

/** Measure `panel` against its nearest bounding container and nudge it inside.
 *  Zero-size rects (jsdom, detached renders) bail without writing styles. */
export function clampPopover(panel: HTMLElement, arrow?: HTMLElement | null): void {
  const r = panel.getBoundingClientRect();
  if (r.width === 0) return;
  const bounds = panel.closest(".pc-bccard, .archivist-modal, .archivist-pc-sheet")?.getBoundingClientRect();
  const dx = clampDx(r.left, r.right, bounds ? bounds.left : 0, bounds ? bounds.right : window.innerWidth);
  if (!dx) return;
  panel.style.marginLeft = `${dx}px`;
  // The caret is absolute INSIDE the panel, so it shifted too — translate it
  // back so it keeps pointing at the trigger. Order matters: translate, then
  // the dress's rotate(45deg).
  if (arrow) arrow.style.transform = `translateX(${-dx}px) rotate(45deg)`;
}
