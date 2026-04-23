/**
 * Shared jsdom polyfill helpers for PC component tests.
 *
 * Obsidian extends `HTMLElement.prototype` with helper methods like
 * `createDiv`, `createEl`, `createSpan`, `addClass`, `removeClass`,
 * `empty`, and `appendText`. Tests running under jsdom don't get these
 * automatically, so `installObsidianDomHelpers()` monkey-patches the
 * prototype once (idempotent via a global symbol flag), and
 * `mountContainer()` hands back a fresh `<div>` attached to
 * `document.body` for component render tests to use as a root.
 */

const INSTALLED = Symbol.for("archivist.pc.dom-helpers-installed");

type ElOpts = { cls?: string; text?: string; attr?: Record<string, string> };

function applyOpts(el: HTMLElement, opts?: ElOpts) {
  if (opts?.cls) opts.cls.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
  if (opts?.text != null) el.textContent = opts.text;
  if (opts?.attr) for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v);
}

export function installObsidianDomHelpers(): void {
  const g = globalThis as unknown as Record<symbol, boolean>;
  if (g[INSTALLED]) return;
  g[INSTALLED] = true;

  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

  proto.createDiv = function (this: HTMLElement, opts?: ElOpts) {
    const child = document.createElement("div");
    applyOpts(child, opts);
    this.appendChild(child);
    return child;
  };

  proto.createEl = function (this: HTMLElement, tag: string, opts?: ElOpts) {
    const child = document.createElement(tag);
    applyOpts(child, opts);
    this.appendChild(child);
    return child;
  };

  proto.createSpan = function (this: HTMLElement, opts?: ElOpts) {
    const child = document.createElement("span");
    applyOpts(child, opts);
    this.appendChild(child);
    return child;
  };

  proto.addClass = function (this: HTMLElement, cls: string) {
    cls.split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c));
    return this;
  };

  proto.addClasses = function (this: HTMLElement, classes: string[]) {
    classes.forEach((cls) => {
      cls.split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c));
    });
    return this;
  };

  proto.removeClass = function (this: HTMLElement, cls: string) {
    cls.split(/\s+/).filter(Boolean).forEach((c) => this.classList.remove(c));
    return this;
  };

  proto.hasClass = function (this: HTMLElement, cls: string) {
    return this.classList.contains(cls);
  };

  proto.empty = function (this: HTMLElement) {
    while (this.firstChild) this.removeChild(this.firstChild);
  };

  proto.appendText = function (this: HTMLElement, text: string) {
    this.appendChild(document.createTextNode(text));
  };
}

export function mountContainer(): HTMLElement {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}
