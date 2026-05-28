/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { createSearchableTagSelect } from "../src/shared/edit/searchable-tag-select";

// Monkey-patch HTMLElement.prototype with Obsidian DOM extension methods
// so the component code works in jsdom.
beforeAll(() => {
  function applyOpts(el: HTMLElement, opts?: { cls?: string; text?: string }) {
    if (opts?.cls) {
      opts.cls.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
    }
    if (opts?.text) {
      el.textContent = opts.text;
    }
  }

  (HTMLElement.prototype as any).createDiv = function (opts?: { cls?: string; text?: string }) {
    const child = document.createElement("div");
    applyOpts(child, opts);
    this.appendChild(child);
    return child;
  };

  (HTMLElement.prototype as any).createEl = function (tag: string, opts?: { cls?: string; text?: string }) {
    const child = document.createElement(tag);
    applyOpts(child, opts);
    this.appendChild(child);
    return child;
  };

  (HTMLElement.prototype as any).createSpan = function (opts?: { cls?: string; text?: string }) {
    const child = document.createElement("span");
    applyOpts(child, opts);
    this.appendChild(child);
    return child;
  };

  (HTMLElement.prototype as any).addClass = function (cls: string) {
    cls.split(/\s+/).filter(Boolean).forEach((c: string) => this.classList.add(c));
    return this;
  };

  (HTMLElement.prototype as any).removeClass = function (cls: string) {
    cls.split(/\s+/).filter(Boolean).forEach((c: string) => this.classList.remove(c));
    return this;
  };

  (HTMLElement.prototype as any).empty = function () {
    while (this.firstChild) this.removeChild(this.firstChild);
  };

  (HTMLElement.prototype as any).appendText = function (text: string) {
    this.appendChild(document.createTextNode(text));
  };
});

function createContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("createSearchableTagSelect", () => {
  let container: HTMLElement;
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    container = createContainer();
    onChange = vi.fn();
  });

  it("renders the wrapper with correct class", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold"],
      selected: [],
      onChange,
    });
    expect(container.querySelector(".archivist-tag-select")).toBeTruthy();
  });

  it("renders pill tags for pre-selected values", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold", "Lightning"],
      selected: ["Fire", "Cold"],
      onChange,
    });
    const pills = container.querySelectorAll(".archivist-tag-pill");
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain("Fire");
    expect(pills[1].textContent).toContain("Cold");
  });

  it("renders an input with placeholder", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire"],
      selected: [],
      onChange,
      placeholder: "Search damage types...",
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Search damage types...");
  });

  it("calls onChange when a pill is removed via x button", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold"],
      selected: ["Fire", "Cold"],
      onChange,
    });
    const removeBtn = container.querySelector(".archivist-tag-pill-x") as HTMLElement;
    removeBtn.click();
    expect(onChange).toHaveBeenCalledWith(["Cold"]);
  });

  it("filters presets based on input text", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Force", "Cold"],
      selected: [],
      onChange,
    });
    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "fi";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const items = container.querySelectorAll(".archivist-tag-dropdown-item:not(.archivist-tag-dropdown-item-selected)");
    const texts = Array.from(items).map(el => el.textContent);
    expect(texts).toContain("Fire");
    expect(texts).not.toContain("Cold");
  });

  it("marks already-selected items as selected in dropdown", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold"],
      selected: ["Fire"],
      onChange,
    });
    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));

    const selectedItem = container.querySelector(".archivist-tag-dropdown-item-selected");
    expect(selectedItem).toBeTruthy();
    expect(selectedItem!.textContent).toContain("Fire");
  });

  it("adds a value when a dropdown item is clicked", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold"],
      selected: [],
      onChange,
    });
    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));

    const items = container.querySelectorAll(".archivist-tag-dropdown-item");
    (items[0] as HTMLElement).dispatchEvent(new MouseEvent("mousedown"));
    expect(onChange).toHaveBeenCalledWith(["Fire"]);
  });

  it("shows custom option when search text matches no preset", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold"],
      selected: [],
      onChange,
    });
    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "Radiant";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const custom = container.querySelector(".archivist-tag-dropdown-custom");
    expect(custom).toBeTruthy();
    expect(custom!.textContent).toContain("Radiant");
  });

  it("adds custom value when custom option is clicked", () => {
    createSearchableTagSelect({
      container,
      presets: ["Fire", "Cold"],
      selected: [],
      onChange,
    });
    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "Necrotic";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const custom = container.querySelector(".archivist-tag-dropdown-custom") as HTMLElement;
    custom.dispatchEvent(new MouseEvent("mousedown"));
    expect(onChange).toHaveBeenCalledWith(["Necrotic"]);
  });
});
