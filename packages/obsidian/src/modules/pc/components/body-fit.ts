/**
 * R4-G6b §8 (Q-6) · the body-fit observer.
 *
 * At the two-column widths the sheet's left rail (the panels) and the right tab panel are two grid cells of one row.
 * When the ACTIVE tab panel is SHORTER than the rail, the two-column dress leaves a tall empty gutter beside a stubby
 * panel; the ruling is that the body then goes ONE column (the 499 tier's dress, restated in `styles/layout.css`) and
 * the rail's panels flow side by side.
 *
 * The decision is always taken from TWO-COLUMN measurements, so the collapsed layout's own heights never feed back:
 * `measureAndDecide` STRIPS `pc-body-fit-one`, MEASURES under `pc-body-measure` (the two-column template with the
 * cells shrunk to their content, so the two rects are the CONTENT heights), then RESTORES the class the decision
 * asks for. The protocol writes the class list every cycle by construction, so what is stable across two identical
 * decisions is the END STATE, not the write count.
 *
 * The ResizeObserver callback performs NO layout write: it schedules `requestAnimationFrame(measureAndDecide)` behind
 * a `scheduled` flag. A callback that changes the layout it observes ends the frame with new sizes and Chromium logs
 * "ResizeObserver loop completed with undelivered notifications", a console ERROR the live harness reads as red.
 *
 * The one feedback path the measurement cannot exclude is EXTERNAL: a decision flip changes the sheet's height, which
 * can add or remove `.view-content`'s vertical scrollbar, which changes the sheet's inline size. `band` is the
 * hysteresis for that path; the T0 probe measured `.view-content`'s scrollbar as OVERLAY on this platform
 * (`offsetWidth - clientWidth` = 0 with `overflow-y: scroll` forced), so the shipped band is 0.
 */
const observers = new WeakMap<HTMLElement, ResizeObserver>();
export function shouldCollapse(sidebarHeight: number, contentHeight: number, wasCollapsed: boolean, band = 0): boolean {
  if (contentHeight < sidebarHeight - band) return true;
  if (contentHeight > sidebarHeight + band) return false;
  return wasCollapsed;
}
export function attachBodyFit(root: HTMLElement, body: HTMLElement, band = 0): void {
  disposeBodyFit(root);
  if (typeof ResizeObserver === "undefined") return;   // jsdom has none: the six test files that call renderPCSheet
  const sidebar = body.querySelector<HTMLElement>(":scope > .pc-sidebar");
  const content = body.querySelector<HTMLElement>(":scope > .pc-content");
  if (!sidebar || !content) return;
  let scheduled = false;
  const measureAndDecide = (): void => {
    scheduled = false;
    if (!body.isConnected) return;
    const wasCollapsed = body.classList.contains("pc-body-fit-one");
    body.classList.remove("pc-body-fit-one");
    body.classList.add("pc-body-measure");
    const sidebarH = sidebar.getBoundingClientRect().height;
    const contentH = content.getBoundingClientRect().height;
    body.classList.remove("pc-body-measure");
    if (shouldCollapse(sidebarH, contentH, wasCollapsed, band)) body.classList.add("pc-body-fit-one");
    else body.classList.remove("pc-body-fit-one");
  };
  const ro = new ResizeObserver(() => {
    // R4-G6b §8.1: NO layout write inside the observer callback (Chromium's "loop completed with undelivered
    // notifications" is a console error the live harness reads as red); schedule the write for the next frame.
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(measureAndDecide);
  });
  ro.observe(body);
  for (const el of Array.from(sidebar.children)) ro.observe(el);
  for (const el of Array.from(content.children)) ro.observe(el);
  observers.set(root, ro);
}
export function disposeBodyFit(root: HTMLElement): void {
  observers.get(root)?.disconnect();
  observers.delete(root);
}
