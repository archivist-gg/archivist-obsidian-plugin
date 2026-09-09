/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
  shouldCollapse,
  attachBodyFit,
  disposeBodyFit,
} from "../packages/obsidian/src/modules/pc/components/body-fit";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("shouldCollapse (R4-G6b §8.1)", () => {
  it("collapses below and restores above the rail height", () => {
    expect(shouldCollapse(600, 500, false)).toBe(true);
    expect(shouldCollapse(600, 700, true)).toBe(false);
  });
  it("holds the previous decision on EQUAL heights at band 0", () => {                 // m21's kill row
    expect(shouldCollapse(600, 600, true)).toBe(true);
    expect(shouldCollapse(600, 600, false)).toBe(false);
  });
  it("holds inside a non-zero band and decides outside it", () => {
    expect(shouldCollapse(600, 590, false, 20)).toBe(false);
    expect(shouldCollapse(600, 610, true, 20)).toBe(true);
    expect(shouldCollapse(600, 570, false, 20)).toBe(true);
    expect(shouldCollapse(600, 630, true, 20)).toBe(false);
  });
});
describe("attachBodyFit (R4-G6b §8.1)", () => {
  class FakeResizeObserver {                        // the tests/pc-builder-selection-table.test.ts idiom
    static last: FakeResizeObserver | null = null;
    observed: Element[] = []; disconnected = false;
    constructor(public cb: ResizeObserverCallback) { FakeResizeObserver.last = this; }
    observe(el: Element): void { this.observed.push(el); }
    disconnect(): void { this.disconnected = true; }
    fire(): void { this.cb([], this as unknown as ResizeObserver); }
  }
  const queued: FrameRequestCallback[] = [];
  let originalRO: unknown; let originalRAF: unknown;
  beforeEach(() => {
    originalRO = globalThis.ResizeObserver; originalRAF = globalThis.requestAnimationFrame;
    (globalThis as never as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
    globalThis.requestAnimationFrame = (cb) => { queued.push(cb); return 1; };
    queued.length = 0;
  });
  afterEach(() => {
    (globalThis as never as { ResizeObserver: unknown }).ResizeObserver = originalRO;
    globalThis.requestAnimationFrame = originalRAF as typeof requestAnimationFrame;
  });
  /** A body with a sidebar and a content column whose rects are stubbed; each stub RECORDS body.className when read. */
  const bodyWith = (sidebarH: number, contentH: number) => {
    const root = mountContainer();
    const body = root.createDiv({ cls: "pc-body" });
    const sidebar = body.createDiv({ cls: "pc-sidebar" }); const panel = sidebar.createDiv({ cls: "pc-panel" });
    const content = body.createDiv({ cls: "pc-content" }); const tabsBar = content.createDiv({ cls: "pc-tabs-bar" });
    const seen: string[] = [];
    const stub = (el: HTMLElement, height: number) => {
      el.getBoundingClientRect = () => { seen.push(body.className); return { height, top: 0, bottom: height, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect; };
    };
    stub(sidebar, sidebarH); stub(content, contentH);
    return { root, body, seen, panel, tabsBar };
  };
  it("the RO callback writes no class; the rAF measures under pc-body-measure; the fit class follows the decision", () => {   // m20's kill row
    const { root, body, seen, panel, tabsBar } = bodyWith(600, 400);
    attachBodyFit(root, body);
    FakeResizeObserver.last!.fire();
    expect(body.className).toBe("pc-body");
    queued.shift()!(0);
    expect(seen).toEqual(["pc-body pc-body-measure", "pc-body pc-body-measure"]);
    expect(body.classList.contains("pc-body-fit-one")).toBe(true);
    expect(body.classList.contains("pc-body-measure")).toBe(false);
    // Fix round 1 (F-4): the two `ro.observe` loops over the rail's and the panel's CHILDREN are Q-6's only
    // tab-switch trigger (a tab swap changes no rect on `body` itself), and both could be deleted with the rest of
    // this file green. The observed list pins them: body first, then each column's children in DOM order.
    expect(FakeResizeObserver.last!.observed).toEqual([body, panel, tabsBar]);
  });
  it("the END STATE holds across two identical fires", () => {
    const { root, body } = bodyWith(600, 400);
    attachBodyFit(root, body);
    FakeResizeObserver.last!.fire(); queued.shift()!(0);
    FakeResizeObserver.last!.fire(); queued.shift()!(0);
    expect(body.className).toBe("pc-body pc-body-fit-one");
  });
  it("a tall panel restores two columns", () => {
    const { root, body } = bodyWith(600, 900);
    body.classList.add("pc-body-fit-one");
    attachBodyFit(root, body);
    FakeResizeObserver.last!.fire(); queued.shift()!(0);
    expect(body.classList.contains("pc-body-fit-one")).toBe(false);
  });
  it("disposeBodyFit disconnects, and without a ResizeObserver global attach does not throw", () => {
    const { root, body } = bodyWith(600, 400);
    attachBodyFit(root, body);
    const ro = FakeResizeObserver.last!;
    disposeBodyFit(root);
    expect(ro.disconnected).toBe(true);
    (globalThis as never as { ResizeObserver: unknown }).ResizeObserver = undefined;
    expect(() => attachBodyFit(root, body)).not.toThrow();
  });
});
