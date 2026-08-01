/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

interface ScopeEntry {
  modifiers: unknown;
  key: string;
  func: () => boolean | void;
}
interface MockModalInstance {
  contentEl: HTMLElement;
  scope: { keys: ScopeEntry[] };
  onOpen?: () => void;
  onClose?: () => void;
  close?: () => void;
}
const modalInstances = vi.hoisted(() => [] as MockModalInstance[]);

vi.mock("obsidian", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("obsidian");
  return {
    ...actual,
    Modal: class {
      app: unknown;
      contentEl: HTMLElement;
      containerEl: HTMLElement;
      scope = {
        keys: [] as ScopeEntry[],
        register(mods: unknown, key: string, cb: () => boolean | void): ScopeEntry {
          const entry: ScopeEntry = { modifiers: mods, key, func: cb };
          this.keys.push(entry);
          return entry;
        },
        unregister(h: ScopeEntry): void {
          const i = this.keys.indexOf(h);
          if (i >= 0) this.keys.splice(i, 1);
        },
      };
      constructor(app: unknown) {
        this.app = app;
        // Mirror the native portal nesting (.modal-container > .modal >
        // content): PaneCenteredModal measures and pads containerEl.
        this.containerEl = document.createElement("div");
        this.contentEl = document.createElement("div");
        this.containerEl.appendChild(this.contentEl);
        document.body.appendChild(this.containerEl);
        modalInstances.push(this as unknown as MockModalInstance);
        // Seeded LAST, mirroring the native constructor: this is the FIFO-first
        // Escape entry a modal must unregister before it can own the key.
        this.scope.register([], "Escape", () => this.close());
      }
      open(): void { (this as unknown as MockModalInstance).onOpen?.(); }
      close(): void { (this as unknown as MockModalInstance).onClose?.(); }
    },
  };
});

import {
  openProficiencyModal, refreshProficiencyModal, closeProficiencyModal,
  type ProficiencyDomain,
} from "../packages/obsidian/src/modules/pc/components/proficiency-edit-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());
afterEach(() => {
  closeProficiencyModal();
  modalInstances.length = 0;
  document.body.replaceChildren();
});

function lastModal(): MockModalInstance { return modalInstances[modalInstances.length - 1]; }

// ───────────────────────────────────────────────────────────────────────────
// The aggregate is NOT mocked: these fixtures drive the REAL engine.
//
// tests/pc-proficiencies-panel.test.ts mocks it with `sources: []` alongside
// `origin: "grant"`, a shape the engine CANNOT produce (the grant path always
// seeds `sources: [g.source]`; only the pick/manual/custom paths yield an empty
// list). A provenance assertion written against that shape is vacuous, and
// provenance is exactly what the chips render · so the entries here come out of
// computeEffectiveProficiencies for real, through cast-built entity fixtures of
// the shape the engine's own tests use.
// ───────────────────────────────────────────────────────────────────────────

interface CharacterShape {
  race?: unknown;
  classes?: unknown[];
  background?: unknown;
  feats?: unknown[];
  overrides?: Record<string, unknown>;
}

function resolved(shape: CharacterShape): ResolvedCharacter {
  return {
    race: shape.race,
    classes: shape.classes ?? [],
    background: shape.background,
    feats: shape.feats ?? [],
    // Non-optional on the real type and walked by the decision engine whenever a
    // class is present, so it is supplied here rather than cast away.
    features: [],
    definition: { origin_choices: {}, overrides: shape.overrides ?? {} },
  } as unknown as ResolvedCharacter;
}

/** A 2014 Dwarf: Common + Dwarvish, both sourced "Dwarf". */
const DWARF = { name: "Dwarf", languages: { fixed: ["common", "dwarvish"] } };

/** 2014 Rogue (`Thieves’ tools`, U+2019) + 2024 Criminal
 *  (`thieves'-tools`, U+0027). Both fold to ONE toProfSlug, so the effective set
 *  carries one value with TWO granting entities · shipped data, and the only
 *  shape that exercises the joined-source chip. */
const ROGUE_2014 = {
  entity: { name: "Rogue", proficiencies: { tools: { fixed: ["Thieves’ tools"] } } },
  level: 1, choices: {},
};
const CRIMINAL_2024 = {
  name: "Criminal",
  tool_proficiencies: [{ kind: "fixed", items: ["thieves'-tools"] }],
};

function makeEditState(): CharacterEditState {
  return {
    addProficiency: vi.fn(),
    removeProficiency: vi.fn(),
  } as unknown as CharacterEditState;
}

function makeCtx(shape: CharacterShape, editState: CharacterEditState | null): ComponentRenderContext {
  return {
    resolved: resolved(shape),
    derived: {} as never,
    services: {} as never,
    app: {} as never,
    editState,
  } as ComponentRenderContext;
}

function openFor(
  domain: ProficiencyDomain,
  shape: CharacterShape,
  editState: CharacterEditState = makeEditState(),
): { el: HTMLElement; editState: CharacterEditState } {
  openProficiencyModal(makeCtx(shape, editState), domain);
  return { el: lastModal().contentEl, editState };
}

const chips = (el: HTMLElement): HTMLElement[] =>
  [...el.querySelectorAll(".pc-prof-modal-chip")] as HTMLElement[];
const rows = (el: HTMLElement): HTMLElement[] =>
  [...el.querySelectorAll(".pc-prof-modal-row")] as HTMLElement[];
const rowValues = (el: HTMLElement): string[] =>
  rows(el).map((r) => r.getAttribute("data-prof") ?? "");
const filterInput = (el: HTMLElement): HTMLInputElement =>
  el.querySelector("input.pc-prof-modal-filter") as HTMLInputElement;
const customInput = (el: HTMLElement): HTMLInputElement =>
  el.querySelector("input.pc-prof-modal-custominput") as HTMLInputElement;
const btn = (el: HTMLElement, cls: string): HTMLButtonElement =>
  el.querySelector(`button.${cls}`) as HTMLButtonElement;

function typeFilter(el: HTMLElement, text: string): void {
  const input = filterInput(el);
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("openProficiencyModal / refreshProficiencyModal guards", () => {
  it("no-ops without editState", () => {
    openProficiencyModal(makeCtx({ race: DWARF }, null), "languages");
    expect(modalInstances.length).toBe(0);
  });

  it("opens for the requested domain and closing then reopening switches domain", () => {
    const es = makeEditState();
    const shape = { race: DWARF, classes: [ROGUE_2014] };
    openProficiencyModal(makeCtx(shape, es), "languages");
    expect(modalInstances.length).toBe(1);
    expect(lastModal().contentEl.querySelector(".pc-prof-modal-title")?.textContent).toBe("Languages");

    // Same domain, same editState: REPAINT, no new modal.
    openProficiencyModal(makeCtx(shape, es), "languages");
    expect(modalInstances.length).toBe(1);

    // Other domain: the house guard (`if (current) { updateContext; return; }`)
    // would silently repaint the LANGUAGES modal here and return.
    openProficiencyModal(makeCtx(shape, es), "tools");
    expect(modalInstances.length).toBe(2);
    expect(lastModal().contentEl.querySelector(".pc-prof-modal-title")?.textContent).toBe("Tools");

    // refresh NEVER changes the domain.
    refreshProficiencyModal(makeCtx(shape, es));
    expect(modalInstances.length).toBe(2);
    expect(lastModal().contentEl.querySelector(".pc-prof-modal-title")?.textContent).toBe("Tools");
  });

  it("refresh with a different editState closes the modal", () => {
    const es = makeEditState();
    openProficiencyModal(makeCtx({ race: DWARF }, es), "languages");
    expect(modalInstances.length).toBe(1);
    refreshProficiencyModal(makeCtx({ race: DWARF }, makeEditState()));
    // Closed: a later refresh with the ORIGINAL state does not resurrect it.
    refreshProficiencyModal(makeCtx({ race: DWARF }, es));
    expect(modalInstances.length).toBe(1);
    expect(lastModal().contentEl.childElementCount).toBe(0);
  });

  it("owns Escape through the base takeover, leaving exactly one Escape handler", () => {
    const es = makeEditState();
    openProficiencyModal(makeCtx({ race: DWARF }, es), "languages");
    const modal = lastModal();
    // The double seeds one built-in Escape; a forgotten unregister shows up as 2.
    expect(modal.scope.keys.filter((k) => k.key === "Escape").length).toBe(1);
    modal.scope.keys.find((k) => k.key === "Escape")!.func();
    expect(modal.contentEl.childElementCount).toBe(0);
  });
});

describe("ProficiencyEditModal chips", () => {
  it("renders a granted chip with .granted, its source name, and a working ×", () => {
    const { el, editState } = openFor("languages", { race: DWARF });
    const chip = el.querySelector('.pc-prof-modal-chip[data-prof="dwarvish"]') as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.classList.contains("granted")).toBe(true);
    expect(chip.querySelector(".pc-prof-modal-chip-src")?.textContent).toBe("Dwarf");
    // U+00D7, not U+2715 · matches every existing chip in the plugin.
    const x = chip.querySelector(".pc-prof-modal-chip-x") as HTMLElement;
    expect(x.textContent).toBe("×");
    x.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.removeProficiency).toHaveBeenCalledWith("languages", "dwarvish");
  });

  it("joins multiple sources with ' · ' on one chip", () => {
    // Spec §16.3 test 10. §17 CANNOT catch this: P3b's live fixture (Rax = 2014
    // Dwarf + 2014 Acolyte) sources both languages to "Dwarf", so the two-source
    // path never runs in the vault. Real case: a 2014 Rogue and a 2024 Criminal
    // both grant thieves' tools under one toProfSlug.
    const { el } = openFor("tools", { classes: [ROGUE_2014], background: CRIMINAL_2024 });
    const chip = el.querySelector('[data-prof="thieves\'-tools"] .pc-prof-modal-chip-src');
    expect(chip?.textContent).toBe("Rogue · Criminal");
    // ONE chip, not two: the two spellings folded.
    expect(chips(el).length).toBe(1);
  });

  it("renders a custom chip verbatim, preserving casing", () => {
    const { el } = openFor("languages", {
      race: DWARF,
      overrides: { languages: { add: ["MCDM Cant"] } },
    });
    const chip = el.querySelector('.pc-prof-modal-chip[data-prof="MCDM Cant"]') as HTMLElement;
    expect(chip).toBeTruthy();
    // Humanizing would render "Mcdm Cant".
    expect(chip.textContent?.startsWith("MCDM Cant")).toBe(true);
    expect(chip.classList.contains("granted")).toBe(false);
    expect(chip.querySelector(".pc-prof-modal-chip-src")?.textContent).toBe("custom");
  });

  it("dresses a manual vocabulary add as 'added', plain (spec §7.3)", () => {
    const { el } = openFor("languages", {
      race: DWARF,
      overrides: { languages: { add: ["elvish"] } },
    });
    const chip = el.querySelector('.pc-prof-modal-chip[data-prof="elvish"]') as HTMLElement;
    expect(chip.classList.contains("granted")).toBe(false);
    expect(chip.querySelector(".pc-prof-modal-chip-src")?.textContent).toBe("added");
  });

  it("shows the empty state and a singular-aware subtitle", () => {
    const empty = openFor("languages", {}).el;
    expect(empty.querySelector(".pc-prof-modal-sub")?.textContent).toBe("You speak no languages.");
    expect(chips(empty).length).toBe(0);
    expect(empty.querySelector(".pc-prof-modal-chips .pc-prof-modal-empty")).toBeTruthy();
    closeProficiencyModal();

    const one = openFor("languages", { race: { name: "Human", languages: { fixed: ["common"] } } }).el;
    expect(one.querySelector(".pc-prof-modal-sub")?.textContent).toBe("You speak 1 language.");
    closeProficiencyModal();

    const two = openFor("languages", { race: DWARF }).el;
    expect(two.querySelector(".pc-prof-modal-sub")?.textContent).toBe("You speak 2 languages.");
  });
});

describe("ProficiencyEditModal addable list", () => {
  it("offers the vocabulary minus the effective set, flat for languages", () => {
    const { el, editState } = openFor("languages", { race: DWARF });
    const values = rowValues(el);
    expect(values).not.toContain("common");
    expect(values).not.toContain("dwarvish");
    expect(values).toContain("elvish");
    expect(el.querySelectorAll(".pc-prof-modal-group").length).toBe(0);
    // Rows are label-sorted, like the chip row.
    const labels = rows(el).map((r) => r.querySelector(".pc-prof-modal-name")?.textContent ?? "");
    expect([...labels].sort()).toEqual(labels);

    btn(el, "pc-prof-modal-pip").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addProficiency).toHaveBeenCalledWith("languages", values[0]);
  });

  it("groups the tool list under the four vocabulary headers", () => {
    const { el } = openFor("tools", {});
    const groups = [...el.querySelectorAll(".pc-prof-modal-group")].map((g) => g.textContent);
    expect(groups).toEqual(["Artisan's Tools", "Musical Instruments", "Gaming Sets", "Other Tools"]);
    expect(rows(el).length).toBe(35);
  });

  it("shows a suppressed grant in the addable list so it can be restored", () => {
    // Suppressed Dwarvish is NOT effective, so without the `∪ suppressed` union
    // it would be missing from the chip row AND (for anything off-vocabulary)
    // from the addable list · unrestorable.
    const { el, editState } = openFor("languages", {
      race: DWARF,
      overrides: { languages: { remove: ["dwarvish"] } },
    });
    expect(chips(el).map((c) => c.getAttribute("data-prof"))).toEqual(["common"]);
    const row = el.querySelector('.pc-prof-modal-row[data-prof="dwarvish"]') as HTMLElement;
    expect(row).toBeTruthy();
    (row.querySelector("button.pc-prof-modal-pip") as HTMLElement)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addProficiency).toHaveBeenCalledWith("languages", "dwarvish");
  });

  it("restores an OFF-VOCABULARY suppressed grant, which only the union can offer", () => {
    // A homebrew grant lives in no vocabulary list, so "vocabulary minus
    // effective" alone can never produce this row.
    const { el, editState } = openFor("tools", {
      overrides: { tools: { remove: ["Runic Cipher"] } },
    });
    const row = el.querySelector('.pc-prof-modal-row[data-prof="Runic Cipher"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.closest(".pc-prof-modal-list")?.querySelectorAll(".pc-prof-modal-group").length)
      .toBe(5);   // the four vocabulary headers plus "Other"
    (row.querySelector("button.pc-prof-modal-pip") as HTMLElement)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addProficiency).toHaveBeenCalledWith("tools", "Runic Cipher");
  });
});

describe("ProficiencyEditModal filtering", () => {
  it("filters the list without touching the search row", () => {
    const { el } = openFor("languages", { race: DWARF });
    const input = filterInput(el);
    typeFilter(el, "elv");
    expect(rowValues(el)).toEqual(["elvish"]);
    // Same element object: the search row is skeleton, never rebuilt.
    expect(filterInput(el)).toBe(input);
  });

  it("keeps the filter text and focus across a background repaint", () => {
    // The skeleton/dynamic split is load-bearing: coin-modal.ts records the
    // reason verbatim. Rebuild the chips + list, NOT the search row.
    const es = makeEditState();
    const shape = { race: DWARF };
    const { el } = openFor("languages", shape, es);
    const input = filterInput(el);
    typeFilter(el, "elv");
    input.focus();
    expect(el.ownerDocument.activeElement).toBe(input);

    refreshProficiencyModal(makeCtx(shape, es));

    expect(filterInput(el)).toBe(input);
    expect(input.value).toBe("elv");
    expect(el.ownerDocument.activeElement).toBe(input);
  });

  it("re-applies the current filter to the rebuilt list", () => {
    // The input's text survives because it is skeleton; the LIST does not. An
    // implementer who rebuilds unfiltered leaves a filter box showing text over
    // an unfiltered list.
    const es = makeEditState();
    const shape = { race: DWARF };
    const { el } = openFor("languages", shape, es);
    typeFilter(el, "elv");
    expect(rowValues(el)).toEqual(["elvish"]);

    refreshProficiencyModal(makeCtx(shape, es));

    expect(filterInput(el).value).toBe("elv");
    expect(rowValues(el)).toEqual(["elvish"]);
  });

  it("shows a no-match empty state, and Enter adds the sole match", () => {
    const { el, editState } = openFor("languages", { race: DWARF });
    typeFilter(el, "zzz");
    expect(rows(el).length).toBe(0);
    expect(el.querySelector(".pc-prof-modal-list .pc-prof-modal-empty")?.textContent)
      .toBe('No match for "zzz".');

    typeFilter(el, "elv");
    filterInput(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(editState.addProficiency).toHaveBeenCalledWith("languages", "elvish");
    // Consuming the term clears the box, which is SKELETON · the list must be
    // rebuilt to match, or an empty filter box sits over a one-row list.
    expect(filterInput(el).value).toBe("");
    expect(rows(el).length).toBeGreaterThan(1);

    // Ambiguous match: deliberately inert.
    (editState.addProficiency as unknown as ReturnType<typeof vi.fn>).mockClear();
    typeFilter(el, "a");
    filterInput(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(editState.addProficiency).not.toHaveBeenCalled();
  });
});

describe("ProficiencyEditModal custom entry", () => {
  it("Add commits, Cancel discards, Enter commits, blur does NOT commit", () => {
    const { el, editState } = openFor("languages", { race: DWARF });
    const form = el.querySelector(".pc-prof-modal-customform") as HTMLElement;
    expect(form.classList.contains("is-open")).toBe(false);

    btn(el, "pc-prof-modal-custombtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(form.classList.contains("is-open")).toBe(true);
    expect(el.ownerDocument.activeElement).toBe(customInput(el));

    // blur commits NOTHING (makeInlineInput's dirty rule is number-only).
    customInput(el).value = "Thieves' Cant";
    customInput(el).dispatchEvent(new FocusEvent("blur", { bubbles: false }));
    expect(editState.addProficiency).not.toHaveBeenCalled();

    // Cancel discards, and clears the box.
    btn(el, "pc-prof-modal-cancel").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addProficiency).not.toHaveBeenCalled();
    expect(form.classList.contains("is-open")).toBe(false);
    expect(customInput(el).value).toBe("");

    // Add commits.
    btn(el, "pc-prof-modal-custombtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    customInput(el).value = "Thieves' Cant";
    btn(el, "pc-prof-modal-ok").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addProficiency).toHaveBeenCalledWith("languages", "Thieves' Cant");
    expect(form.classList.contains("is-open")).toBe(false);

    // Enter commits.
    btn(el, "pc-prof-modal-custombtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    customInput(el).value = "Deep Runes";
    customInput(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(editState.addProficiency).toHaveBeenCalledWith("languages", "Deep Runes");
  });

  it("rejects an empty custom value and keeps the form open", () => {
    const { el, editState } = openFor("languages", { race: DWARF });
    btn(el, "pc-prof-modal-custombtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    customInput(el).value = "   ";
    btn(el, "pc-prof-modal-ok").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addProficiency).not.toHaveBeenCalled();
    expect((el.querySelector(".pc-prof-modal-customform") as HTMLElement).classList.contains("is-open"))
      .toBe(true);
    expect(customInput(el).classList.contains("is-error")).toBe(true);
  });

  it("Escape discards the custom form first, then closes the modal", () => {
    const es = makeEditState();
    openProficiencyModal(makeCtx({ race: DWARF }, es), "languages");
    const modal = lastModal();
    const el = modal.contentEl;
    const escape = modal.scope.keys.find((k) => k.key === "Escape")!.func;

    btn(el, "pc-prof-modal-custombtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    escape();
    expect((el.querySelector(".pc-prof-modal-customform") as HTMLElement).classList.contains("is-open"))
      .toBe(false);
    expect(el.childElementCount).toBeGreaterThan(0);   // still open

    escape();
    expect(el.childElementCount).toBe(0);
  });
});

describe("ProficiencyEditModal copy hygiene", () => {
  it("contains no em dash anywhere in its subtree", () => {
    const { el } = openFor("tools", {
      classes: [ROGUE_2014],
      background: CRIMINAL_2024,
      overrides: { tools: { add: ["Tinker's Contraption"], remove: ["Runic Cipher"] } },
    });
    expect(el.textContent).not.toMatch(/—/);
  });
});
