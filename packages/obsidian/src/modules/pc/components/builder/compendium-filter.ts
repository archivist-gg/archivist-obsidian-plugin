import { Scope, type App } from "obsidian";
import type { Compendium } from "../../../../shared/entities/compendium-manager";
import type { RegisteredEntity } from "@archivist-gg/core";
import { clampPopoverToViewport } from "../popover-utils";

/** Ticked-compendium set for the universal pickers. All ticked by default;
 *  unticking a compendium hides its content. Names, not editions: the
 *  compendium IS the source (parent spec §6). */
export interface CompendiumTickState {
  ticked: Set<string>;
}

export function allTicked(compendiums: Compendium[]): CompendiumTickState {
  return { ticked: new Set(compendiums.map((c) => c.name)) };
}

export function matchesTicked(entity: RegisteredEntity, state: CompendiumTickState): boolean {
  return state.ticked.has(entity.compendium);
}

/** Candidates per compendium: the popover's counts. Callers pass the whole
 *  candidate pool (visibility and exclusions applied, the search NOT applied),
 *  so the rows and their numbers hold still while the user types. */
export function countByCompendium(entities: readonly RegisteredEntity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entities) counts.set(e.compendium, (counts.get(e.compendium) ?? 0) + 1);
  return counts;
}

export interface CompendiumFilterOptions {
  /** Visible compendiums (hidden ones already removed). */
  compendiums: Compendium[];
  /** `countByCompendium` over the candidate pool. */
  counts: ReadonlyMap<string, number>;
  state: CompendiumTickState;
  /** The caller's table redraw, fired after every tick change. */
  onChange: () => void;
  /** Owns the keymap the popover's Escape scope is pushed onto. Optional only
   *  because test contexts carry no app. */
  app?: App;
  /** The host modal's scope, when the picker lives in one: it becomes the
   *  popover scope's parent, so a modal's hotkey isolation holds while the
   *  popover is open. Defaults to `app.scope` (the sheet). */
  scope?: Scope;
}

/** A to Z ignoring case, with numbers compared as numbers (`Book 9` < `Book 10`). */
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
const byName = (a: string, b: string): number => collator.compare(a, b);

let current: { root: HTMLElement; btn: HTMLElement; cleanup: () => void } | null = null;

export function closeCompendiumFilterPopover(): void {
  if (!current) return;
  const { root, btn, cleanup } = current;
  current = null;
  cleanup();
  root.remove();
  btn.setAttribute("aria-expanded", "false");
  btn.classList.remove("is-open");
}

/** The one-line compendium filter: a button that sits beside the picker's
 *  search and opens a checklist of the compendiums that hold a candidate for
 *  THIS pick. Mounted once into the picker's persistent shell (never inside
 *  its redraw region), so the button keeps its node, and focus, across table
 *  redraws. Renders nothing when fewer than two compendiums hold a candidate:
 *  there is nothing to filter. */
export function renderCompendiumFilter(parent: HTMLElement, opts: CompendiumFilterOptions): void {
  const rows = opts.compendiums
    .filter((c) => (opts.counts.get(c.name) ?? 0) > 0)
    .map((c) => c.name)
    .sort(byName);
  if (rows.length < 2) {
    // No button means no way to undo a narrowing, so a saved tick (from when
    // more compendiums held candidates) must not keep hiding what is left.
    for (const name of rows) opts.state.ticked.add(name);
    return;
  }

  const btn = parent.createEl("button", {
    cls: "pc-bfilter-btn",
    attr: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" },
  });
  btn.createSpan({ cls: "pc-bfilter-btn-k", text: "Compendium" });
  const value = btn.createSpan({ cls: "pc-bfilter-btn-v" });
  btn.createSpan({ cls: "pc-bfilter-caret", text: "▾", attr: { "aria-hidden": "true" } });

  const refresh = (): void => {
    const on = rows.filter((n) => opts.state.ticked.has(n)).length;
    value.setText(on === rows.length ? `All ${rows.length}` : `${on} of ${rows.length}`);
    btn.classList.toggle("is-filtered", on !== rows.length);
  };
  refresh();

  btn.addEventListener("click", () => {
    if (current?.btn === btn) {
      closeCompendiumFilterPopover();
      return;
    }
    openPopover(btn, rows, opts.compendiums.length - rows.length, opts, () => {
      refresh();
      opts.onChange();
    });
  });
}

function openPopover(
  btn: HTMLElement,
  rows: string[],
  empty: number,
  opts: CompendiumFilterOptions,
  changed: () => void,
): void {
  closeCompendiumFilterPopover();
  // Captured once: open and cleanup must address the same document even if
  // focus moves to another window in between.
  const doc = btn.ownerDocument;
  const win = doc.defaultView ?? activeWindow;

  // On the body, so the modal's scrolling body cannot clip it. The body sits
  // outside both the sheet and the modal, and `archivist-modal` is the class
  // that declares the parchment tokens and the crimson checkbox.
  const root = doc.body.createDiv({
    cls: "archivist-modal pc-bfilter-pop",
    attr: { role: "dialog", "aria-label": "Compendiums" },
  });
  const head = root.createDiv({ cls: "pc-bfilter-pop-h" });
  head.createSpan({ text: "Compendiums" });
  const acts = head.createSpan({ cls: "pc-bfilter-acts" });
  const allBtn = acts.createEl("button", { cls: "pc-bfilter-act", text: "All", attr: { type: "button" } });
  acts.createSpan({ cls: "pc-bfilter-dot", text: "·" });
  const noneBtn = acts.createEl("button", { cls: "pc-bfilter-act", text: "None", attr: { type: "button" } });

  // A picker re-render replaces the button and table this popover was opened
  // for; a tick after that would drive the detached pair, so it closes instead.
  const live = (): boolean => {
    if (btn.isConnected) return true;
    closeCompendiumFilterPopover();
    return false;
  };
  const list = root.createDiv({ cls: "pc-bfilter-list" });
  const boxes: { name: string; row: HTMLElement; box: HTMLInputElement }[] = [];
  const sync = (): void => {
    for (const { name, row, box } of boxes) {
      box.checked = opts.state.ticked.has(name);
      row.classList.toggle("off", !box.checked);
    }
  };
  for (const name of rows) {
    const row = list.createEl("label", { cls: "pc-bfilter-row" });
    const box = row.createEl("input", { attr: { type: "checkbox" } });
    row.createSpan({ cls: "pc-bfilter-name", text: name });
    row.createSpan({ cls: "pc-bfilter-n", text: String(opts.counts.get(name) ?? 0) });
    boxes.push({ name, row, box });
    box.addEventListener("change", () => {
      if (!live()) return;
      if (box.checked) opts.state.ticked.add(name);
      else opts.state.ticked.delete(name);
      sync();
      changed();
    });
  }
  sync();
  const setAll = (on: boolean): void => {
    if (!live()) return;
    for (const name of rows) {
      if (on) opts.state.ticked.add(name);
      else opts.state.ticked.delete(name);
    }
    sync();
    changed();
  };
  allBtn.addEventListener("click", () => setAll(true));
  noneBtn.addEventListener("click", () => setAll(false));

  if (empty > 0) {
    root.createDiv({
      cls: "pc-bfilter-foot",
      text: empty === 1 ? "1 other compendium has none" : `${empty} other compendiums have none`,
    });
  }

  // Right-aligned under the button, then kept inside the viewport.
  const anchorRect = btn.getBoundingClientRect();
  root.style.top = `${anchorRect.bottom + win.scrollY + 4}px`;
  root.style.left = `${anchorRect.right + win.scrollX - root.offsetWidth}px`;
  clampPopoverToViewport(root, anchorRect);

  // Escape: Obsidian's Keymap listens in the capture phase on the window and
  // hands the key to the TOP scope, which is the open modal's, so a document
  // listener would run only after the modal had already closed. A pushed scope
  // is on top while the popover is open; its strict `false` makes the Keymap
  // stop the event there. The parent keeps every other hotkey working.
  const escape = (): void => {
    closeCompendiumFilterPopover();
    btn.focus();
  };
  const keymap = opts.app?.keymap;
  let scope: Scope | null = null;
  if (keymap) {
    scope = new Scope(opts.scope ?? opts.app!.scope);
    scope.register([], "Escape", () => {
      escape();
      return false;
    });
    keymap.pushScope(scope);
  }
  // In a pop-out window there is no Keymap at all (it binds the main window
  // only), so a document listener is the Escape path there. In the main window
  // it never fires: the Keymap has already stopped the event.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    escape();
  };
  // Tabbing out closes it: over a modal, the popover's scope has replaced the
  // modal's focus trap, and focus would otherwise wander behind the modal. The
  // popover sits last in the body, so a Tab off its last control leaves the
  // document with a null relatedTarget (measured live), which no focusout check
  // can tell from a click on the popover's own padding: the two ends of the Tab
  // order are therefore handled on the key, handing focus back to the button.
  root.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const stops = Array.from(root.querySelectorAll<HTMLElement>("button, input"));
    const edge = e.shiftKey ? stops[0] : stops[stops.length - 1];
    if (e.target !== edge) return;
    e.preventDefault();
    escape();
  });
  // Focus moving to a control elsewhere (a click on another field) also leaves.
  root.addEventListener("focusout", (e: FocusEvent) => {
    const to = e.relatedTarget;
    if (!(to instanceof Node) || root.contains(to) || btn.contains(to)) return;
    closeCompendiumFilterPopover();
  });

  // The opening click is still bubbling when this listener lands; it comes
  // from inside the button, which the check below ignores.
  const onClick = (e: MouseEvent): void => {
    if (!(e.target instanceof Node)) return;
    if (root.contains(e.target) || btn.contains(e.target)) return;
    closeCompendiumFilterPopover();
  };
  // Scrolling anything but the list itself moves the button out from under
  // the popover.
  const onScroll = (e: Event): void => {
    if (e.target instanceof Node && root.contains(e.target)) return;
    closeCompendiumFilterPopover();
  };
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKeyDown);
  win.addEventListener("scroll", onScroll, true);

  current = {
    root,
    btn,
    cleanup: () => {
      doc.removeEventListener("click", onClick);
      doc.removeEventListener("keydown", onKeyDown);
      win.removeEventListener("scroll", onScroll, true);
      if (scope) keymap!.popScope(scope);
    },
  };
  btn.setAttribute("aria-expanded", "true");
  btn.classList.add("is-open");
  boxes[0]?.box.focus({ preventScroll: true });
}

/** Colour class: homebrew compendium → green; else the entity's own edition
 *  (2024 → blue, anything else → muted grey). The Compendium type carries no
 *  edition, so colour derives from entity metadata — honest even when a
 *  compendium mixes editions. */
export function sourceTagCls(entity: RegisteredEntity): "hb" | "e2024" | "e2014" {
  if (entity.homebrew) return "hb";
  return (entity.data as { edition?: string }).edition === "2024" ? "e2024" : "e2014";
}

/** Plain coloured-text source tag; the text is always the compendium name. */
export function renderSourceTag(parent: HTMLElement, entity: RegisteredEntity): void {
  parent.createSpan({ cls: `pc-bsrc ${sourceTagCls(entity)}`, text: entity.compendium });
}
