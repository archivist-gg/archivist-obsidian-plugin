import { Modal } from "obsidian";

/**
 * Base class for every Archivist modal. Behaves exactly like Obsidian's `Modal`
 * except that it centres on the active workspace pane instead of the window.
 *
 * WHY: Obsidian portals modal DOM into a window-level overlay
 * (`.modal-container`, `position:absolute; inset:0`) that flex-centres `.modal`
 * on the WHOLE WINDOW. Our sheets are centred inside their workspace leaf, and
 * that leaf is inset from the window's left edge by the ribbon + left sidebar
 * (44px + 257px at default widths). The modal therefore lands exactly HALF the
 * left-dock width to the left of the sheet's centre — 150px — and because that
 * offset is `dockWidth / 2`, it is independent of window width and never
 * self-corrects on resize. The window's top chrome shifts it up the same way.
 *
 * HOW: pad `.modal-container` by the active leaf's insets so the existing flex
 * centring resolves against the leaf's box rather than the window's.
 *
 * Padding is used rather than `left/top/width/height` ON PURPOSE: `.modal-bg`
 * (the dim behind the modal) is `position:absolute; inset:0`, which resolves
 * against the container's PADDING box, so the dim still covers the whole
 * window — only the modal moves. Shrinking the container itself would shrink
 * the dim to the pane and leave the sidebars undimmed.
 *
 * A pane narrower than the modal is safe: `.modal` is a shrinkable flex item
 * with a `min-width` floor, so it shrinks to the floor and then overflows the
 * (padded) content box symmetrically. The container is still window-sized with
 * `overflow: visible`, so the modal stays fully on screen.
 */
export class PaneCenteredModal extends Modal {
  private paneObserver: ResizeObserver | null = null;

  open(): void {
    super.open();
    this.centerOnActivePane();
  }

  close(): void {
    this.paneObserver?.disconnect();
    this.paneObserver = null;
    super.close();
  }

  private centerOnActivePane(): void {
    // Scope the lookup to the modal's OWN document so a modal opened from a
    // pop-out window centres on that window's pane, not the main window's.
    const doc = this.containerEl.ownerDocument;
    const pane =
      doc.querySelector<HTMLElement>(".workspace-leaf.mod-active") ??
      doc.querySelector<HTMLElement>(".workspace-split.mod-root");
    // No workspace to centre on. Leave Obsidian's window centring untouched
    // rather than guessing at an offset.
    if (!pane) return;

    const apply = () => {
      const paneRect = pane.getBoundingClientRect();
      // A collapsed or not-yet-laid-out pane would pad the container down to
      // nothing and stack the modal in a corner; fall back to window centring.
      if (paneRect.width <= 0 || paneRect.height <= 0) {
        this.containerEl.style.removeProperty("padding");
        return;
      }
      // Measured fresh each time, but stable: the container keeps `inset: 0`
      // with `width: auto`, so adding padding shrinks its CONTENT box and
      // leaves its border box window-sized. That makes this idempotent.
      const box = this.containerEl.getBoundingClientRect();
      const px = (n: number) => `${Math.max(0, Math.round(n))}px`;
      this.containerEl.style.padding = [
        px(paneRect.top - box.top),
        px(box.right - paneRect.right),
        px(box.bottom - paneRect.bottom),
        px(paneRect.left - box.left),
      ].join(" ");
    };

    apply();
    // Keep it centred for as long as the modal is open: collapsing a sidebar or
    // resizing the window resizes the leaf, which fires this. Writing padding on
    // the container cannot resize the pane, so there is no observer loop.
    this.paneObserver = new ResizeObserver(apply);
    this.paneObserver.observe(pane);
  }
}
