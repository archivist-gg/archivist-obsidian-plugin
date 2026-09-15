/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderPCSheet, renderPCSheetError } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { SheetComponent, ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";
import type { PCServices } from "../packages/obsidian/src/modules/pc/pc.services";

beforeAll(() => installObsidianDomHelpers());

class Probe implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement, _ctx?: ComponentRenderContext) { el.createDiv({ cls: `probe-${this.type}`, text: this.type }); }
}

function fullRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  for (const t of [
    "header-section", "ac-shield", "hp-widget", "hit-dice-widget",
    "ability-row", "stats-tiles", "defenses-conditions-panel",
    "senses-panel", "skills-panel", "proficiencies-panel",
    "tabs-container",
  ]) r.register(new Probe(t));
  return r;
}

/** The tests/pc-builder-selection-table.test.ts idiom; the R4-G7 RIDER-7 row fires `cb` on every instance
 *  the render constructed. */
class FakeResizeObserver {
  observed: Element[] = []; disconnected = false;
  constructor(public cb: ResizeObserverCallback) {}
  observe(el: Element): void { this.observed.push(el); }
  disconnect(): void { this.disconnected = true; }
}

const resolved = { state: {}, definition: { class: [{}] } } as unknown as ResolvedCharacter;
const derived = {} as DerivedStats;
const services = {} as PCServices;

describe("renderPCSheet", () => {
  it("empties root then writes the sheet wrapper", () => {
    const root = mountContainer();
    root.createDiv({ cls: "should-be-cleared" });
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), services, app: {} as never, editState: null, warnings: [] });
    expect(root.querySelector(".should-be-cleared")).toBeNull();
    expect(root.querySelector(".archivist-pc-sheet")).not.toBeNull();
  });

  it("renders hero cluster, stats band, sidebar, and tabs content", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), services, app: {} as never, editState: null, warnings: [] });
    expect(root.querySelector(".pc-hero .probe-header-section")).not.toBeNull();
    expect(root.querySelector(".pc-abilities .probe-ability-row")).not.toBeNull();
    expect(root.querySelector(".pc-stats-right .probe-stats-tiles")).not.toBeNull();
    expect(root.querySelector(".pc-stats-right .probe-defenses-conditions-panel")).not.toBeNull();
    expect(root.querySelector(".pc-sidebar .probe-skills-panel")).not.toBeNull();
    expect(root.querySelector(".pc-sidebar .probe-senses-panel")).not.toBeNull();
    expect(root.querySelector(".pc-sidebar .probe-proficiencies-panel")).not.toBeNull();
    expect(root.querySelector(".pc-content .probe-tabs-container")).not.toBeNull();
    expect(root.querySelector(".probe-saves-panel")).toBeNull();
    expect(root.querySelector(".probe-combat-stats-row")).toBeNull();
  });

  it("renders warning banner when warnings non-empty", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), services, app: {} as never, editState: null, warnings: ["Missing race", "Bad slug"] });
    const items = root.querySelectorAll(".archivist-pc-warnings li");
    expect(items.length).toBe(2);
  });

  it("does not render warning banner when empty", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), services, app: {} as never, editState: null, warnings: [] });
    expect(root.querySelector(".archivist-pc-warnings")).toBeNull();
  });

  it("shows '(No renderer for X)' for unregistered components", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: new ComponentRegistry(), services, app: {} as never, editState: null, warnings: [] });
    const missings = [...root.querySelectorAll(".pc-empty-line")].map((e) => e.textContent);
    expect(missings.some((t) => t?.includes("No renderer for header-section"))).toBe(true);
  });
});

describe("renderPCSheetError", () => {
  it("renders error with H2, message, and fallback button", () => {
    const root = mountContainer();
    let called = false;
    renderPCSheetError(root, "Boom", () => { called = true; });
    expect(root.querySelector(".archivist-pc-error h2")?.textContent).toBe("Cannot render character sheet");
    expect(root.textContent).toContain("Boom");
    (root.querySelector<HTMLButtonElement>("button.mod-cta")!).click();
    expect(called).toBe(true);
  });

});

/**
 * R4-G7 RIDER-7 · Q-6 REVERSED (the user, 2026-09-15: "it must always be on right"). The tab body sits to
 * the right of the skills rail whatever the active tab's height; only the pane's WIDTH (the 499 tier in
 * `styles/layout.css`) may stack the body. The retired R4-G6b body-fit observer collapsed `.pc-body` to one
 * column (`pc-body-fit-one`) whenever the active panel was shorter than the rail, measured by a
 * ResizeObserver that scheduled its read and write behind `requestAnimationFrame`. So this row stubs both,
 * gives the rail a tall box and the panel a short one, fires every observer the render installed, flushes
 * every queued frame, and reads the body's class list at each step. jsdom does no layout, so the heights
 * are stubbed on `getBoundingClientRect`, which is what that observer read.
 */
describe("the tab body stays right of the rail whatever the tab's height (R4-G7 RIDER-7)", () => {
  it("a short tab panel beside a tall rail never collapses .pc-body to one column", () => {
    const instances: FakeResizeObserver[] = [];
    const queued: FrameRequestCallback[] = [];
    const originalRO = globalThis.ResizeObserver;
    const originalRAF = globalThis.requestAnimationFrame;
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const rect = (height: number): DOMRect =>
      ({ height, top: 0, bottom: height, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    (globalThis as never as { ResizeObserver: unknown }).ResizeObserver = class extends FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) { super(cb); instances.push(this); }
    };
    globalThis.requestAnimationFrame = (cb) => { queued.push(cb); return queued.length; };
    // The rail and everything in it is 900 px tall; the tab column and everything in it is 120 px.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      if (this.closest(".pc-sidebar")) return rect(900);
      if (this.closest(".pc-content")) return rect(120);
      return rect(1020);
    };
    try {
      const root = mountContainer();
      renderPCSheet({ root, resolved, derived, registry: fullRegistry(), services, app: {} as never, editState: null, warnings: [] });
      const body = root.querySelector<HTMLElement>(".pc-body")!;
      const seen: string[] = [body.className];
      for (let round = 0; round < 3; round++) {
        for (const ro of instances) { ro.cb([], ro as unknown as ResizeObserver); seen.push(body.className); }
        while (queued.length) { queued.shift()!(0); seen.push(body.className); }
      }
      expect(seen.filter((c) => c.includes("pc-body-fit-one"))).toEqual([]);
      expect(body.className).toBe("pc-body");
    } finally {
      (globalThis as never as { ResizeObserver: unknown }).ResizeObserver = originalRO;
      globalThis.requestAnimationFrame = originalRAF;
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });
});

describe("buildSubtitle (V7)", () => {
  it("does NOT include alignment even when set", async () => {
    const { buildSubtitle } = await import("../packages/obsidian/src/modules/pc/components/header-section");
    const r = {
      race: { name: "Human" },
      classes: [{ entity: { name: "Artificer" }, level: 13, subclass: null, choices: {} }],
      background: null,
      definition: { alignment: "Lawful Neutral", race: "[[human]]", subrace: null },
    } as any;
    expect(buildSubtitle(r)).not.toContain("Lawful Neutral");
  });
});
