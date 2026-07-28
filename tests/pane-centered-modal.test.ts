/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PaneCenteredModal } from "@/shared/modals/pane-centered-modal";

/** Obsidian centres `.modal-container` on the WINDOW; the sheet is centred in
 *  its leaf, and the leaf is inset by the ribbon + left sidebar. These are the
 *  real numbers measured in the live app: a 2560x1440 window, a 44px ribbon and
 *  a 257px sidebar, so the leaf starts at x=301 under a 40px title/tab bar. */
const WINDOW = mkRect(0, 0, 2560, 1440);
const LEAF = mkRect(301, 40, 2259, 1400);

function mkRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x, y, width, height,
    top: y, left: x, right: x + width, bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  observed: Element[] = [];
  disconnected = false;
  constructor(public cb: ResizeObserverCallback) { FakeResizeObserver.last = this; }
  observe(el: Element): void { this.observed.push(el); }
  unobserve(): void {}
  disconnect(): void { this.disconnected = true; }
  fire(): void { this.cb([], this as unknown as ResizeObserver); }
}

function addPane(cls: string, r: DOMRect): HTMLElement {
  const el = document.createElement("div");
  el.className = cls;
  el.getBoundingClientRect = () => r;
  document.body.appendChild(el);
  return el;
}

function openModal(): PaneCenteredModal {
  const modal = new PaneCenteredModal({} as never);
  modal.containerEl.getBoundingClientRect = () => WINDOW;
  modal.open();
  return modal;
}

/** Padding as read back off the container, in CSS shorthand order. */
function pads(modal: PaneCenteredModal): [string, string, string, string] {
  const s = modal.containerEl.style;
  return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
}

let originalRO: typeof ResizeObserver;

beforeEach(() => {
  originalRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  FakeResizeObserver.last = null;
});

afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  document.body.innerHTML = "";
});

describe("PaneCenteredModal", () => {
  it("pads the container by the active leaf's insets", () => {
    addPane("workspace-leaf mod-active", LEAF);
    expect(pads(openModal())).toEqual(["40px", "0px", "0px", "301px"]);
  });

  it("centres the modal on the pane, not the window", () => {
    addPane("workspace-leaf mod-active", LEAF);
    const modal = openModal();
    const [top, right, bottom, left] = pads(modal).map((p) => parseFloat(p));

    // Where flex centring resolves once the content box is padded.
    const centreX = (left + (WINDOW.width - right)) / 2;
    const centreY = (top + (WINDOW.height - bottom)) / 2;

    expect([centreX, centreY]).toEqual([LEAF.x + LEAF.width / 2, LEAF.y + LEAF.height / 2]);
    // ...and that is NOT where the window would have put it. The modal moves
    // right by exactly half the 301px left dock, which is how far left of the
    // sheet's centre window-centring was putting it.
    expect(centreX - WINDOW.width / 2).toBe(150.5);
  });

  it("falls back to the root split when no leaf is active", () => {
    addPane("workspace-split mod-root", mkRect(301, 0, 2259, 1440));
    expect(pads(openModal())).toEqual(["0px", "0px", "0px", "301px"]);
  });

  it("prefers the active leaf over the root split", () => {
    addPane("workspace-split mod-root", mkRect(301, 0, 2259, 1440));
    addPane("workspace-leaf mod-active", LEAF);
    expect(pads(openModal())).toEqual(["40px", "0px", "0px", "301px"]);
  });

  it("leaves Obsidian's window centring alone when there is no workspace", () => {
    const modal = openModal();
    expect(pads(modal)).toEqual(["", "", "", ""]);
    expect(FakeResizeObserver.last).toBeNull();
  });

  it("clamps to zero rather than emitting negative padding", () => {
    // A pane reported outside the container (pop-out edge cases, sub-pixel
    // rounding) must not produce `padding: -4px`, which the browser drops.
    addPane("workspace-leaf mod-active", mkRect(-40, -10, 2700, 1500));
    expect(pads(openModal())).toEqual(["0px", "0px", "0px", "0px"]);
  });

  it("falls back to window centring for a zero-size pane", () => {
    // A collapsed / not-yet-laid-out leaf would otherwise pad the container to
    // nothing and stack the modal in the top-left corner.
    addPane("workspace-leaf mod-active", mkRect(0, 0, 0, 0));
    expect(pads(openModal())).toEqual(["", "", "", ""]);
  });

  it("re-centres when the pane resizes (sidebar collapse, window resize)", () => {
    const pane = addPane("workspace-leaf mod-active", LEAF);
    const modal = openModal();
    expect(FakeResizeObserver.last?.observed).toContain(pane);

    // Collapse the left sidebar: the leaf now starts just past the 44px ribbon.
    pane.getBoundingClientRect = () => mkRect(44, 40, 2516, 1400);
    FakeResizeObserver.last?.fire();
    expect(pads(modal)).toEqual(["40px", "0px", "0px", "44px"]);
  });

  it("disconnects the observer on close", () => {
    addPane("workspace-leaf mod-active", LEAF);
    const modal = openModal();
    expect(FakeResizeObserver.last?.disconnected).toBe(false);
    modal.close();
    expect(FakeResizeObserver.last?.disconnected).toBe(true);
  });
});
