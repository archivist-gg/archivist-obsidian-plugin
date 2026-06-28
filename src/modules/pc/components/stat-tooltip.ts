/** Attach a hover popover to a stat element. Mirrors the AC shield's pattern
 *  (ac-shield.ts:21–41): mouseenter renders a `.pc-stat-tooltip` host child via
 *  `render`; mouseleave removes it. Guards against double-create so repeated
 *  mouseenter events (e.g. moving across nested children) leave a single host. */
export function attachStatTooltip(anchor: HTMLElement, render: (host: HTMLElement) => void): void {
  let host: HTMLElement | null = null;
  anchor.addEventListener("mouseenter", () => {
    if (host) return;
    host = anchor.createDiv({ cls: "pc-stat-tooltip" });
    render(host);
  });
  anchor.addEventListener("mouseleave", () => {
    host?.remove();
    host = null;
  });
}
