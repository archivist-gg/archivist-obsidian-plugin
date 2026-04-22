// Backtick-triggered autocomplete dropdown for formula tags in feature textareas.

import type { Abilities } from "../types";
import { resolveFormulaTag } from "../dnd/formula-tags";
import { abilityModifier, formatModifier } from "../dnd/math";
import { ABILITY_KEYS, ABILITY_NAMES } from "../dnd/constants";

// Structural host interface: minimal shape of the edit-state object this
// autocomplete reads from. Kept local so this shared module has no dependency
// on any entity-specific edit-state (monster, and future PC/spell/item, etc.).
// Any caller supplying `.current.abilities` and `.current.proficiencyBonus`
// can reuse this autocomplete regardless of their concrete edit-state type.
interface TagAutocompleteHost {
  current: {
    abilities?: Abilities;
    proficiencyBonus?: number;
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagOption {
  group: string;
  tag: string;        // display text, e.g. `atk:STR`
  insertText: string; // what gets inserted (with backticks)
  description: string;
  preview: string;    // live-calculated value or empty
  hasPlaceholder: boolean; // whether insertText contains _ placeholders
}

// ---------------------------------------------------------------------------
// Tag catalog builder
// ---------------------------------------------------------------------------

function buildTagOptions(abilities: Abilities, profBonus: number): TagOption[] {
  const opts: TagOption[] = [];

  // --- Attack tags ---
  for (const key of ABILITY_KEYS) {
    const name = ABILITY_NAMES[key];
    const preview = resolveFormulaTag("atk", name, abilities, profBonus);
    opts.push({
      group: "Attack",
      tag: `atk:${name}`,
      insertText: `\`atk:${name}\``,
      description: `${name} + Prof`,
      preview,
      hasPlaceholder: false,
    });
  }

  // --- Damage tags ---
  for (const key of ["str", "dex"] as const) {
    const name = ABILITY_NAMES[key];
    const mod = abilityModifier(abilities[key]);
    const modStr = formatModifier(mod);
    opts.push({
      group: "Damage",
      tag: `damage:_d_+${name}`,
      insertText: `\`damage:_d_+${name}\``,
      description: `Dice + ${name} mod`,
      preview: modStr,
      hasPlaceholder: true,
    });
  }

  // --- Save DC tags ---
  for (const key of ABILITY_KEYS) {
    const name = ABILITY_NAMES[key];
    const preview = resolveFormulaTag("dc", name, abilities, profBonus);
    opts.push({
      group: "Save DC",
      tag: `dc:${name}`,
      insertText: `\`dc:${name}\``,
      description: `8 + Prof + ${name}`,
      preview,
      hasPlaceholder: false,
    });
  }

  // --- Static / template tags ---
  opts.push({
    group: "Static",
    tag: "dice:_d_",
    insertText: "`dice:_d_`",
    description: "Roll dice",
    preview: "",
    hasPlaceholder: true,
  });
  opts.push({
    group: "Static",
    tag: "atk:+_",
    insertText: "`atk:+_`",
    description: "Static attack",
    preview: "",
    hasPlaceholder: true,
  });
  opts.push({
    group: "Static",
    tag: "damage:_d_+_",
    insertText: "`damage:_d_+_`",
    description: "Static damage",
    preview: "",
    hasPlaceholder: true,
  });
  opts.push({
    group: "Static",
    tag: "dc:_",
    insertText: "`dc:_`",
    description: "Static save DC",
    preview: "",
    hasPlaceholder: true,
  });

  return opts;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createDropdown(doc: Document, options: TagOption[], filter: string): { el: HTMLElement; items: HTMLElement[]; filteredOptions: TagOption[] } {
  const el = doc.createElement("div");
  el.className = "archivist-tag-autocomplete";

  const items: HTMLElement[] = [];
  const filteredOptions: TagOption[] = [];

  const lowerFilter = filter.toLowerCase();

  let lastGroup = "";
  for (const opt of options) {
    // Filter: match against tag or description
    if (lowerFilter && !opt.tag.toLowerCase().includes(lowerFilter) && !opt.description.toLowerCase().includes(lowerFilter)) {
      continue;
    }
    filteredOptions.push(opt);

    // Group header
    if (opt.group !== lastGroup) {
      lastGroup = opt.group;
      const groupEl = doc.createElement("div");
      groupEl.className = "archivist-tag-ac-group";
      groupEl.textContent = opt.group;
      el.appendChild(groupEl);
    }

    // Item row
    const item = doc.createElement("div");
    item.className = "archivist-tag-ac-item";

    const left = doc.createElement("span");

    const tagSpan = doc.createElement("span");
    tagSpan.className = "archivist-tag-ac-tag";
    tagSpan.textContent = opt.tag;
    left.appendChild(tagSpan);

    const descSpan = doc.createElement("span");
    descSpan.className = "archivist-tag-ac-desc";
    descSpan.textContent = "  " + opt.description;
    left.appendChild(descSpan);

    item.appendChild(left);

    if (opt.preview) {
      const previewSpan = doc.createElement("span");
      previewSpan.className = "archivist-tag-ac-preview";
      previewSpan.textContent = opt.preview;
      item.appendChild(previewSpan);
    }

    el.appendChild(item);
    items.push(item);
  }

  return { el, items, filteredOptions };
}

// ---------------------------------------------------------------------------
// Cursor position in textarea (pixel coordinates)
// ---------------------------------------------------------------------------

function getCaretCoordinates(textarea: HTMLTextAreaElement): { x: number; y: number } {
  const doc = textarea.doc;
  const win = textarea.win;
  // Create a mirror div to measure caret position
  const mirror = doc.createElement("div");
  mirror.className = "archivist-tag-autocomplete-mirror";
  const style = win.getComputedStyle(textarea);
  const props = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "textTransform", "wordSpacing", "textIndent", "whiteSpace",
    "lineHeight", "padding", "paddingTop", "paddingRight", "paddingBottom",
    "paddingLeft", "border", "borderWidth", "boxSizing",
  ] as const;

  // Width must match the live textarea's computed width, so keep this inline.
  mirror.style.width = style.width;

  for (const prop of props) {
    (mirror.style as unknown as Record<string, string>)[prop] = style.getPropertyValue(
      prop.replace(/([A-Z])/g, "-$1").toLowerCase()
    );
  }

  doc.body.appendChild(mirror);

  const textBefore = textarea.value.substring(0, textarea.selectionStart);
  mirror.textContent = textBefore;

  // Add a span at the caret position
  const marker = doc.createElement("span");
  marker.textContent = "|";
  mirror.appendChild(marker);

  const rect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  // Account for scroll offset inside the textarea
  const x = rect.left + (markerRect.left - mirror.getBoundingClientRect().left) - textarea.scrollLeft;
  const y = rect.top + (markerRect.top - mirror.getBoundingClientRect().top) - textarea.scrollTop;

  doc.body.removeChild(mirror);

  return { x, y };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function attachTagAutocomplete(textarea: HTMLTextAreaElement, state: TagAutocompleteHost): void {
  let dropdown: HTMLElement | null = null;
  let itemEls: HTMLElement[] = [];
  let filteredOpts: TagOption[] = [];
  let selectedIdx = 0;
  let backtickPos = -1; // position of the opening backtick in textarea value
  let isOpen = false;

  function open() {
    close(); // clean up any existing dropdown

    const abilities = state.current.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const profBonus = state.current.proficiencyBonus ?? 2;
    const allOptions = buildTagOptions(abilities, profBonus);

    // Get filter text (everything after the backtick)
    const filter = backtickPos >= 0 ? textarea.value.substring(backtickPos + 1, textarea.selectionStart) : "";

    const doc = textarea.doc;
    const win = textarea.win;
    const result = createDropdown(doc, allOptions, filter);
    if (result.filteredOptions.length === 0) {
      return;
    }

    dropdown = result.el;
    itemEls = result.items;
    filteredOpts = result.filteredOptions;
    selectedIdx = 0;

    // Position the dropdown
    const coords = getCaretCoordinates(textarea);
    const lineHeight = parseFloat(win.getComputedStyle(textarea).lineHeight) || 20;

    // Decide above or below based on available space.
    // Only `top` triggers the eslint rule; using setCssProps for consistent dynamic positioning.
    const spaceBelow = win.innerHeight - (coords.y + lineHeight);
    if (spaceBelow < 220) {
      // Position above
      dropdown.style.left = `${coords.x}px`;
      dropdown.style.bottom = `${win.innerHeight - coords.y + 4}px`;
      dropdown.setCssProps({ top: "auto" });
    } else {
      // Position below
      dropdown.style.left = `${coords.x}px`;
      dropdown.style.top = `${coords.y + lineHeight + 4}px`;
    }

    // Highlight first item
    updateSelection();

    // Wire up click handlers
    for (let i = 0; i < itemEls.length; i++) {
      const idx = i;
      itemEls[i].addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent textarea blur
        selectItem(idx);
      });
    }

    doc.body.appendChild(dropdown);
    isOpen = true;
  }

  function close() {
    if (dropdown && dropdown.parentElement) {
      dropdown.parentElement.removeChild(dropdown);
    }
    dropdown = null;
    itemEls = [];
    filteredOpts = [];
    selectedIdx = 0;
    backtickPos = -1;
    isOpen = false;
  }

  function updateSelection() {
    for (let i = 0; i < itemEls.length; i++) {
      itemEls[i].classList.toggle("selected", i === selectedIdx);
    }
    // Scroll selected item into view
    if (itemEls[selectedIdx]) {
      itemEls[selectedIdx].scrollIntoView({ block: "nearest" });
    }
  }

  function selectItem(idx: number) {
    const opt = filteredOpts[idx];
    if (!opt) { close(); return; }

    // Remove the backtick we typed (and any filter text after it)
    const before = textarea.value.substring(0, backtickPos);
    const after = textarea.value.substring(textarea.selectionStart);
    const inserted = opt.insertText;

    textarea.value = before + inserted + after;

    // Position cursor
    if (opt.hasPlaceholder) {
      // Find first placeholder `_` inside the inserted text (skip the leading backtick)
      const placeholderIdx = inserted.indexOf("_", 1);
      if (placeholderIdx >= 0) {
        // Find the extent of consecutive _ characters (for _d_ patterns, select just the first _)
        textarea.selectionStart = backtickPos + placeholderIdx;
        textarea.selectionEnd = backtickPos + placeholderIdx + 1;
      } else {
        textarea.selectionStart = textarea.selectionEnd = backtickPos + inserted.length;
      }
    } else {
      textarea.selectionStart = textarea.selectionEnd = backtickPos + inserted.length;
    }

    // Trigger input event so edit state picks up the change
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    close();
    textarea.focus();
  }

  function refresh() {
    if (!isOpen || backtickPos < 0) return;

    const abilities = state.current.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const profBonus = state.current.proficiencyBonus ?? 2;
    const allOptions = buildTagOptions(abilities, profBonus);

    const filter = textarea.value.substring(backtickPos + 1, textarea.selectionStart);
    const result = createDropdown(textarea.doc, allOptions, filter);

    if (result.filteredOptions.length === 0) {
      close();
      return;
    }

    // Replace dropdown content
    if (dropdown && dropdown.parentElement) {
      const parent = dropdown.parentElement;
      const oldLeft = dropdown.style.left;
      const oldTop = dropdown.style.top;
      const oldBottom = dropdown.style.bottom;

      parent.removeChild(dropdown);

      dropdown = result.el;
      dropdown.style.left = oldLeft;
      dropdown.style.top = oldTop;
      dropdown.style.bottom = oldBottom;

      parent.appendChild(dropdown);
    } else {
      dropdown = result.el;
    }

    itemEls = result.items;
    filteredOpts = result.filteredOptions;

    // Clamp selection
    if (selectedIdx >= filteredOpts.length) {
      selectedIdx = Math.max(0, filteredOpts.length - 1);
    }
    updateSelection();

    // Wire up click handlers
    for (let i = 0; i < itemEls.length; i++) {
      const idx = i;
      itemEls[i].addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectItem(idx);
      });
    }
  }

  // --- Event listeners ---

  textarea.addEventListener("keydown", (e) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % filteredOpts.length;
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + filteredOpts.length) % filteredOpts.length;
      updateSelection();
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectItem(selectedIdx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  });

  textarea.addEventListener("input", () => {
    if (!isOpen) {
      // Check if a backtick was just typed
      const pos = textarea.selectionStart;
      if (pos > 0 && textarea.value[pos - 1] === "`") {
        backtickPos = pos - 1;
        open();
      }
      return;
    }

    // If open, refresh the filter
    // But first check the backtick is still there
    if (backtickPos < 0 || backtickPos >= textarea.value.length || textarea.value[backtickPos] !== "`") {
      close();
      return;
    }

    // Check cursor is still after the backtick
    if (textarea.selectionStart <= backtickPos) {
      close();
      return;
    }

    // Check for closing backtick or space in filter — close if found
    const filterText = textarea.value.substring(backtickPos + 1, textarea.selectionStart);
    if (filterText.includes("`") || filterText.includes("\n")) {
      close();
      return;
    }

    refresh();
  });

  textarea.addEventListener("blur", () => {
    // Small delay to allow click events on dropdown items to fire
    textarea.win.setTimeout(() => close(), 150);
  });

  // Also close on scroll (parent containers)
  textarea.addEventListener("scroll", () => {
    if (isOpen) close();
  });
}
