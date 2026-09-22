/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { Scope } from "obsidian";
import type { App } from "obsidian";
import {
  allTicked, matchesTicked, countByCompendium, renderCompendiumFilter, closeCompendiumFilterPopover,
  sourceTagCls, renderSourceTag,
} from "../packages/obsidian/src/modules/pc/components/builder/compendium-filter";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { Compendium } from "../packages/obsidian/src/shared/entities/compendium-manager";
import type { RegisteredEntity } from "@core/entity-registry";

beforeAll(() => installObsidianDomHelpers());

afterEach(() => {
  closeCompendiumFilterPopover();
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

const comp = (name: string, homebrew = false): Compendium =>
  ({ name, description: "", readonly: !homebrew, homebrew, hidden: false, folderPath: `Compendium/${name}` });

const ent = (compendium: string, homebrew: boolean, edition?: string): RegisteredEntity =>
  ({
    slug: "x", name: "X", entityType: "race", filePath: "f.md",
    data: edition ? { edition } : {}, compendium, readonly: !homebrew, homebrew,
  });

/** The two keymap calls the popover makes, recorded on a stack like Obsidian's. */
function keymapApp(): { app: App; stack: Scope[] } {
  const stack: Scope[] = [];
  const app = {
    scope: new Scope(),
    keymap: {
      pushScope: (s: Scope) => { stack.push(s); },
      popScope: (s: Scope) => { const i = stack.indexOf(s); if (i >= 0) stack.splice(i, 1); },
    },
  } as unknown as App;
  return { app, stack };
}

function mount(names: string[], counts: Record<string, number>, app?: App, scope?: Scope) {
  const root = mountContainer();
  const compendiums = names.map((n) => comp(n));
  const state = allTicked(compendiums);
  const onChange = vi.fn();
  renderCompendiumFilter(root, {
    compendiums, counts: new Map(Object.entries(counts)), state, onChange, app, scope,
  });
  const btn = root.querySelector<HTMLButtonElement>(".pc-bfilter-btn");
  return { root, state, onChange, btn };
}

const pop = (): HTMLElement | null => document.body.querySelector<HTMLElement>(".pc-bfilter-pop");
const rowNames = (): (string | null)[] =>
  [...pop()!.querySelectorAll(".pc-bfilter-name")].map((n) => n.textContent);
const rowOf = (name: string): HTMLElement =>
  [...pop()!.querySelectorAll<HTMLElement>(".pc-bfilter-row")]
    .find((r) => r.querySelector(".pc-bfilter-name")?.textContent === name)!;
const boxOf = (name: string): HTMLInputElement => rowOf(name).querySelector<HTMLInputElement>("input")!;
const label = (btn: HTMLElement | null): string | null | undefined =>
  btn?.querySelector(".pc-bfilter-btn-v")?.textContent;

// Six compendiums hold a candidate, one ("Empty") holds none. Manager order is
// deliberately NOT alphabetical.
const NAMES = ["UA", "Book 10", "laserllama", "Empty", "Book 9", "DMG 2024", "Me"];
const COUNTS = { UA: 1, "Book 10": 2, laserllama: 3, "Book 9": 1, "DMG 2024": 4, Me: 1 };

describe("compendium tick state", () => {
  it("starts with every compendium ticked", () => {
    const st = allTicked([comp("SRD 5e"), comp("SRD 2024"), comp("Me", true)]);
    expect(st.ticked.size).toBe(3);
    expect(matchesTicked(ent("SRD 5e", false, "2014"), st)).toBe(true);
  });

  it("hides entities whose compendium is not in the tick state", () => {
    const st = allTicked([comp("SRD 5e")]);
    expect(matchesTicked(ent("Unknown Comp", false), st)).toBe(false);
  });

  it("counts candidates per compendium", () => {
    const counts = countByCompendium([ent("A", false), ent("A", false), ent("B", true)]);
    expect([...counts.entries()]).toEqual([["A", 2], ["B", 1]]);
  });
});

describe("compendium filter button + popover", () => {
  it("at rest the button reads All N, where N counts only compendiums holding a candidate", () => {
    const { btn } = mount(NAMES, COUNTS);
    expect(btn).not.toBeNull();
    expect(label(btn)).toBe("All 6");
    expect(btn!.classList.contains("is-filtered")).toBe(false);
    expect(pop()).toBeNull();
  });

  it("the popover lists those compendiums A to Z (case-insensitive, numbers in order), each with its count", () => {
    const { root, btn } = mount(NAMES, COUNTS);
    btn!.click();
    expect(pop()).not.toBeNull();
    expect(root.contains(pop())).toBe(false); // portalled to the body, out of the modal's scroller
    expect(rowNames()).toEqual(["Book 9", "Book 10", "DMG 2024", "laserllama", "Me", "UA"]);
    expect(rowOf("DMG 2024").querySelector(".pc-bfilter-n")!.textContent).toBe("4");
    expect(boxOf("DMG 2024").checked).toBe(true);
  });

  it("unticking a row filters its compendium out, redraws, and the button reads k of N", () => {
    const { state, onChange, btn } = mount(NAMES, COUNTS);
    btn!.click();
    boxOf("Me").click();
    expect(state.ticked.has("Me")).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(label(btn)).toBe("5 of 6");
    expect(btn!.classList.contains("is-filtered")).toBe(true);
    expect(rowOf("Me").classList.contains("off")).toBe(true);
    expect(pop()).not.toBeNull(); // stays open for the next tick

    boxOf("Me").click();
    expect(state.ticked.has("Me")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(label(btn)).toBe("All 6");
    expect(btn!.classList.contains("is-filtered")).toBe(false);
  });

  it("None unticks every listed compendium and All ticks them back", () => {
    const { state, onChange, btn } = mount(NAMES, COUNTS);
    btn!.click();
    const act = (text: string) =>
      [...pop()!.querySelectorAll<HTMLElement>(".pc-bfilter-act")].find((a) => a.textContent === text)!;
    act("None").click();
    expect([...state.ticked].sort()).toEqual(["Empty"]);
    expect([...pop()!.querySelectorAll<HTMLInputElement>("input")].some((b) => b.checked)).toBe(false);
    expect(label(btn)).toBe("0 of 6");
    act("All").click();
    expect(state.ticked.size).toBe(7);
    expect([...pop()!.querySelectorAll<HTMLInputElement>("input")].every((b) => b.checked)).toBe(true);
    expect(label(btn)).toBe("All 6");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("a footer counts the compendiums that hold nothing here", () => {
    mount([...NAMES, "Nada"], COUNTS).btn!.click();
    expect(pop()!.querySelector(".pc-bfilter-foot")!.textContent).toBe("2 other compendiums have none");
  });

  it("the footer is singular for one empty compendium and absent for none", () => {
    mount(NAMES, COUNTS).btn!.click();
    expect(pop()!.querySelector(".pc-bfilter-foot")!.textContent).toBe("1 other compendium has none");
    closeCompendiumFilterPopover();
    mount(NAMES.filter((n) => n !== "Empty"), COUNTS).btn!.click();
    expect(pop()!.querySelector(".pc-bfilter-foot")).toBeNull();
  });

  it("fewer than two compendiums holding a candidate: nothing to filter, so no button", () => {
    const { root, btn } = mount(["A", "B"], { A: 3 });
    expect(btn).toBeNull();
    expect(root.querySelector(".pc-bfilter-btn")).toBeNull();
  });

  it("with no button, a saved tick cannot keep hiding the one compendium left", () => {
    // A persisted narrowing (A unticked while B still held candidates) meets a
    // pool where only A is left: no control would remain to undo it.
    const compendiums = [comp("A"), comp("B")];
    const state = { ticked: new Set(["B"]) };
    renderCompendiumFilter(mountContainer(), {
      compendiums, counts: new Map([["A", 3]]), state, onChange: vi.fn(),
    });
    expect(state.ticked.has("A")).toBe(true);
  });

  it("Escape closes the popover through its own pushed keymap scope, so it never reaches the modal", () => {
    const { app, stack } = keymapApp();
    const { btn } = mount(NAMES, COUNTS, app);
    btn!.click();
    expect(stack).toHaveLength(1);
    const esc = (stack[0] as unknown as { keys: { key: string; func: () => unknown }[] }).keys
      .filter((k) => k.key === "Escape");
    expect(esc).toHaveLength(1);
    expect(esc[0].func()).toBe(false); // strict false = Obsidian stops the event here
    expect(pop()).toBeNull();
    expect(stack).toHaveLength(0);
    expect(document.activeElement).toBe(btn);
  });

  it("a host scope, when given, is the parent instead (a modal keeps its hotkey isolation)", () => {
    const { app, stack } = keymapApp();
    const modalScope = new Scope();
    mount(NAMES, COUNTS, app, modalScope).btn!.click();
    expect((stack[0] as unknown as { parent?: Scope }).parent).toBe(modalScope);
  });

  it("with no Keymap on this window (a pop-out), Escape on the document still closes it", () => {
    const { btn } = mount(NAMES, COUNTS);
    btn!.click();
    const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(pop()).toBeNull();
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btn);
  });

  it("Tab out of the popover closes it; a focus loss to nowhere (a click on its padding) does not", () => {
    const { root } = mount(NAMES, COUNTS);
    root.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    boxOf("Me").dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    expect(pop()).not.toBeNull();
    boxOf("Me").dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    expect(pop()).toBeNull();
  });

  it("Tab past the last box (or Shift+Tab before the first control) closes it and hands focus back to the button", () => {
    // Measured live: a real Tab off the last box leaves the document with a
    // null relatedTarget, which no focusout check can tell from a click on the
    // popover's own padding, so the popover owns the Tab key at its two ends.
    const { btn } = mount(NAMES, COUNTS);
    btn!.click();
    const last = boxOf("UA");
    last.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    last.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(pop()).toBeNull();
    expect(document.activeElement).toBe(btn);

    btn!.click();
    const first = pop()!.querySelector<HTMLElement>(".pc-bfilter-act")!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(pop()).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it("Tab between the popover's own controls is left to the browser", () => {
    const { btn } = mount(NAMES, COUNTS);
    btn!.click();
    const mid = boxOf("Me");
    mid.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    mid.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    expect(pop()).not.toBeNull();
  });

  it("a tick after the picker re-rendered closes the popover instead of driving the detached table", () => {
    const { root, onChange } = mount(NAMES, COUNTS);
    root.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    root.remove();
    boxOf("Me").click();
    expect(pop()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the popover is a labelled dialog and the caret is not part of the button's name", () => {
    const { btn } = mount(NAMES, COUNTS);
    expect(btn!.getAttribute("aria-haspopup")).toBe("dialog");
    expect(btn!.querySelector(".pc-bfilter-caret")!.getAttribute("aria-hidden")).toBe("true");
    btn!.click();
    expect(pop()!.getAttribute("role")).toBe("dialog");
    expect(pop()!.getAttribute("aria-label")).toBe("Compendiums");
  });

  it("the pushed scope falls back to the app scope for every other key", () => {
    const { app, stack } = keymapApp();
    mount(NAMES, COUNTS, app).btn!.click();
    expect((stack[0] as unknown as { parent?: Scope }).parent).toBe((app as unknown as { scope: Scope }).scope);
  });

  it("a click inside keeps it open; a click outside closes it and pops the scope", () => {
    const { app, stack } = keymapApp();
    mount(NAMES, COUNTS, app).btn!.click();
    rowOf("Me").querySelector<HTMLElement>(".pc-bfilter-name")!.click();
    expect(pop()).not.toBeNull();
    document.body.click();
    expect(pop()).toBeNull();
    expect(stack).toHaveLength(0);
  });

  it("scrolling the list keeps it open; scrolling the page closes it", () => {
    mount(NAMES, COUNTS).btn!.click();
    pop()!.querySelector(".pc-bfilter-list")!.dispatchEvent(new Event("scroll"));
    expect(pop()).not.toBeNull();
    document.dispatchEvent(new Event("scroll"));
    expect(pop()).toBeNull();
  });

  it("opening moves focus to the first checkbox, so the list is reachable from the keyboard", () => {
    mount(NAMES, COUNTS).btn!.click();
    expect(document.activeElement).toBe(boxOf("Book 9"));
  });

  it("clicking the button again closes it", () => {
    const { btn } = mount(NAMES, COUNTS);
    btn!.click();
    btn!.click();
    expect(pop()).toBeNull();
    expect(btn!.getAttribute("aria-expanded")).toBe("false");
  });

  it("closeCompendiumFilterPopover tears it down and pops the scope (view teardown)", () => {
    const { app, stack } = keymapApp();
    mount(NAMES, COUNTS, app).btn!.click();
    closeCompendiumFilterPopover();
    expect(pop()).toBeNull();
    expect(stack).toHaveLength(0);
  });
});

describe("source tags", () => {
  it("colour-keys tags: homebrew green class, 2024 blue class, else grey class", () => {
    expect(sourceTagCls(ent("Me", true, "2024"))).toBe("hb");
    expect(sourceTagCls(ent("SRD 2024", false, "2024"))).toBe("e2024");
    expect(sourceTagCls(ent("SRD 5e", false, "2014"))).toBe("e2014");
    expect(sourceTagCls(ent("SRD 5e", false))).toBe("e2014");
  });

  it("tag text is always the compendium name", () => {
    const root = mountContainer();
    renderSourceTag(root, ent("SRD 2024", false, "2024"));
    const tag = root.querySelector(".pc-bsrc")!;
    expect(tag.textContent).toBe("SRD 2024");
    expect(tag.classList.contains("e2024")).toBe(true);
  });
});
