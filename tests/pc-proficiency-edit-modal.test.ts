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

/** COUNTING PASSTHROUGH, not a stub: the real `aggregateProficiencies` still runs
 *  and its real output is returned, so nothing about engine faithfulness is
 *  traded away. The counter exists to pin that the engine is entered ONCE per
 *  repaint and NEVER per keystroke · `aggregateProficiencies` is unmemoized and
 *  runs two full walks (collectProficiencySources + computeEffectiveProficiencies)
 *  per call, so a regression that moved it back onto the filter path would be
 *  silent, and would falsify the comment that justifies having no debounce. */
const engineCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("@archivist-gg/dnd5e/pc/pc.proficiencies", async () => {
  const actual = await vi.importActual<
    typeof import("@archivist-gg/dnd5e/pc/pc.proficiencies")
  >("@archivist-gg/dnd5e/pc/pc.proficiencies");
  return {
    ...actual,
    aggregateProficiencies: (r: Parameters<typeof actual.aggregateProficiencies>[0]) => {
      engineCalls.n++;
      return actual.aggregateProficiencies(r);
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
  features?: unknown[];
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
    // Shape-driven since R4-P3c: a hardcoded `[]` here cannot host a feature
    // EFFECT grant, and effect grants are now a display-path proficiency source
    // (assembleEffectFeatures -> collectProficiencyEffectGrants).
    features: shape.features ?? [],
    // Non-optional on the real type as well. Both are GUARDED in
    // assembleEffectFeatures (`resolved.pools ?? []`, `resolved.state?.
    // active_buffs ?? []`), so neither is what makes the effect-grant tests
    // pass · they are here for the same reason `features` is, not as the fix.
    pools: [],
    state: {},
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
  // A fresh object per call, so no `vi.fn()` here needs a reset between tests
  // (`vitest.config.ts` sets no `clearMocks` / `restoreMocks`).
  return {
    addProficiency: vi.fn(),
    removeProficiency: vi.fn(),
    setToolProficiency: vi.fn(),
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

/** A race whose TRAIT grants a proficiency through a `kind: "proficiency"`
 *  effect · the shape R4-P3c gives the five SRD-2014 traits that used to state a
 *  proficiency in prose and grant nothing.
 *
 *  `source` is supplied on the fixture feature deliberately, and every future
 *  fixture feature must supply one too: `collectProficiencyEffectGrants`
 *  dereferences `rf.source.kind` and `rf.source.slug` with no guard, so an
 *  omission throws a TypeError out of `aggregateProficiencies`.
 *
 *  What that LOOKS like, measured rather than assumed: the throw lands inside
 *  `updateDynamic()`, which `onOpen` runs AFTER `buildSkeleton()`, so the
 *  skeleton is fully rendered · contentEl keeps all 6 children (title, sub,
 *  chips, searchrow, customform, list) and reads "Languages+ CustomAddCancel".
 *  Only the three things `updateDynamic` fills stay empty: the subtitle text,
 *  the chips row (not even the `chips-empty` hint, since `renderChips` never
 *  ran) and the list. The symptom is therefore a modal that looks FUNCTIONAL
 *  and is simply blank inside, with no error surfaced · not a missing modal.
 *  Do not go looking for a render that never happened.
 *
 *  The race SLUG is inert for the display name · `nameFor`'s `race` arm reads
 *  `resolved.race.name` and never matches the slug. It is carried anyway because
 *  the `feat`, `class` and `subclass` arms DO match on it, so a fixture that
 *  omitted it would not generalize. */
function ctxWithEffectGrant(spec: {
  race: { slug: string; name: string };
  trait: { name: string; effects: unknown[] };
}): ComponentRenderContext {
  return makeCtx({
    race: spec.race,
    features: [{
      feature: { id: `${spec.race.slug}:${spec.trait.name}`, name: spec.trait.name, effects: spec.trait.effects },
      source: { kind: "race", slug: spec.race.slug, level: 1 },
    }],
  }, makeEditState());
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

  it("registers ONE Escape handler and it is the takeover's, not the built-in", () => {
    const es = makeEditState();
    openProficiencyModal(makeCtx({ race: DWARF }, es), "languages");
    const modal = lastModal();
    // Count is 1 BEFORE any takeover too (spec §11): the double seeds exactly one
    // built-in Escape, so this clause guards only against a FORGOTTEN unregister
    // (which shows up as 2), never against a missing takeover.
    expect(modal.scope.keys.filter((k) => k.key === "Escape").length).toBe(1);
    // What discriminates: takeOverEscape wraps the handler to return a STRICT
    // false (pane-centered-modal.ts), the only return that makes Keymap
    // preventDefault/stopPropagation. The built-in returns Modal.close()'s void.
    // Drop the takeover and this is `undefined`.
    const escape = modal.scope.keys.find((k) => k.key === "Escape")!;
    expect(escape.func()).toBe(false);
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

  it("renders the granting SPECIES name on an effect-granted chip, not the trait name", () => {
    const ctx = ctxWithEffectGrant({
      race: { slug: "srd-5e_race_rock-gnome", name: "Rock Gnome" },
      trait: { name: "Tinker", effects: [{ kind: "proficiency", proficiency_type: "tool", value: "tinker's-tools" }] },
    });
    openProficiencyModal(ctx, "tools");
    // NB: a CSS single-quoted string terminates at the apostrophe, so
    // "[data-prof='tinker's-tools']" throws SyntaxError. Use the file's own
    // chips() helper instead.
    const chip = chips(document.body).find((c) => c.getAttribute("data-prof") === "tinker's-tools")!;
    // EXACT string. toContain/toBeTruthy are forbidden here: a source-resolution
    // miss yields sources: [] -> sourceText returns "" -> a blank line that no
    // loose assertion would catch.
    expect(chip.querySelector(".pc-prof-modal-chip-src")!.textContent).toBe("Rock Gnome");
    expect(chip.classList.contains("granted")).toBe(true);
  });

  it("renders the granting species name on an effect-granted LANGUAGE chip", () => {
    const ctx = ctxWithEffectGrant({
      race: { slug: "r", name: "Warden-Touched" },
      trait: { name: "T", effects: [{ kind: "proficiency", proficiency_type: "language", value: "orc" }] },
    });
    openProficiencyModal(ctx, "languages");
    const chip = chips(document.body).find((c) => c.getAttribute("data-prof") === "orc")!;
    expect(chip.querySelector(".pc-prof-modal-chip-src")!.textContent).toBe("Warden-Touched");
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
    const sub = empty.querySelector(".pc-prof-modal-sub")?.textContent;
    expect(sub).toBe("You speak no languages.");
    expect(chips(empty).length).toBe(0);
    // The empty chips row must NOT restate the subtitle: the two sit stacked and
    // the duplicate reads as a rendering bug. Distinct class, distinct sentence.
    const chipsEmpty = empty.querySelector(".pc-prof-modal-chips .pc-prof-modal-chips-empty");
    expect(chipsEmpty).toBeTruthy();
    expect(chipsEmpty?.textContent).not.toBe(sub);
    expect(chipsEmpty?.textContent).toBe("Add one from the list below, or create a custom one.");
    // The two empty states are separately addressable: neither class matches the
    // other's element, so T10 and §17 cannot select the wrong one.
    expect(empty.querySelectorAll(".pc-prof-modal-chips-empty").length).toBe(1);
    expect(empty.querySelectorAll(".pc-prof-modal-list-empty").length).toBe(0);
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

  it("enters the engine ONCE per repaint and never on a keystroke", () => {
    // The property that earns "no debounce". aggregateProficiencies is unmemoized
    // and walks race/classes/background/feats plus the decision engine twice per
    // call; updateDynamic hoists it so renderList filters a prebuilt snapshot.
    const es = makeEditState();
    const shape = { race: DWARF };
    const { el } = openFor("languages", shape, es);

    engineCalls.n = 0;
    typeFilter(el, "e");
    typeFilter(el, "el");
    typeFilter(el, "elv");
    typeFilter(el, "");
    expect(engineCalls.n).toBe(0);

    // ONE per repaint, not two: renderChips and the candidate build share the
    // single effective set updateDynamic computes.
    refreshProficiencyModal(makeCtx(shape, es));
    expect(engineCalls.n).toBe(1);
  });

  it("shows a no-match empty state, and Enter adds the sole match", () => {
    const { el, editState } = openFor("languages", { race: DWARF });
    typeFilter(el, "zzz");
    expect(rows(el).length).toBe(0);
    expect(el.querySelector(".pc-prof-modal-list .pc-prof-modal-list-empty")?.textContent)
      .toBe('No match for "zzz".');
    expect(el.querySelectorAll(".pc-prof-modal-chips-empty").length).toBe(0);

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

    // Typing clears the rejection dress · otherwise the box stays red while the
    // user fixes the very thing that reddened it.
    customInput(el).value = "Deep Runes";
    customInput(el).dispatchEvent(new Event("input", { bubbles: true }));
    expect(customInput(el).classList.contains("is-error")).toBe(false);
  });

  it("re-clicking '+ Custom' on an OPEN form refocuses instead of wiping the value", () => {
    const { el } = openFor("languages", { race: DWARF });
    const custom = btn(el, "pc-prof-modal-custombtn");
    custom.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    customInput(el).value = "Deep Runes";
    // The search row stays visible while the form is open, so the button is still
    // clickable · an unconditional clear here loses in-progress text.
    filterInput(el).focus();
    custom.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(customInput(el).value).toBe("Deep Runes");
    expect(el.ownerDocument.activeElement).toBe(customInput(el));
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

describe("R4-G4 §9.3 the tools tri control (UR1)", () => {
  // Both grant thieves' tools (ROGUE_2014 U+2019, CRIMINAL_2024 U+0027), so they fold
  // to ONE chip · the pairing the "joins multiple sources" test above already pins.
  const TOOLS = { classes: [ROGUE_2014], background: CRIMINAL_2024 };
  // `data-prof` is `entry.value`, the slug WITH the apostrophe (types/choice.ts keeps it).
  // `?.` deliberately: without the control the query is null, and a bare `!` would throw a
  // TypeError before the first `expect` ran, turning a value diff into a crash.
  const tri = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>(`.pc-prof-modal-chip[data-prof="thieves'-tools"] .pc-prof-modal-tri`);

  // THE REACHABLE STATES (controller ruling at T10, spec §9.3). `setToolProficiency`
  // persists `expertise` and `none` and writes the ABSENT key for `proficient`, so:
  //   (1) on a PLAIN data grant the modal cycle is three-state · proficient -> expertise
  //       -> none (the chip DISAPPEARS, because `computeEffectiveProficiencies` applies the
  //       tri and these chips ARE its output) -> the candidate row's pip, whose
  //       `addProficiency` clears the `none` -> proficient again;
  //   (2) on a DATA-expertise tool (a 2014 Rogue 6's thieves' tools) the cycle is TWO-state
  //       · expertise -> none -> the pip -> expertise. No modal click ever persists
  //       `proficient` for it, so the engine's "proficient clears a data expertise" arm is
  //       reachable only from a hand-edited note (dnd5e tests/pc-proficiency-effective.test.ts).
  // Booked as a known limitation rather than redesigned.

  it("RED FIRST: a granted tools chip carries a tri reading proficient; a click asks the edit state for expertise", () => {
    const es = makeEditState();
    const { el } = openFor("tools", TOOLS, es);
    expect(tri(el)?.dataset.tri).toBe("proficient");
    tri(el)!.click();
    expect(es.setToolProficiency).toHaveBeenCalledWith(expect.stringMatching(/thieves/i), "expertise");
  });

  it("an expertise override reads expertise (chip class .expertise); the next click asks for none", () => {
    const es = makeEditState();
    const { el } = openFor("tools", { ...TOOLS, overrides: { tools: { proficiency: { "thieves'-tools": "expertise" } } } }, es);
    expect(tri(el)?.dataset.tri).toBe("expertise");
    expect(tri(el)!.closest(".pc-prof-modal-chip")!.classList.contains("expertise")).toBe(true);
    tri(el)!.click();
    expect(es.setToolProficiency).toHaveBeenCalledWith(expect.stringMatching(/thieves/i), "none");
  });

  it("a none override DROPS the chip and returns it to the candidate rows ONCE", () => {
    // A CONTROL, green before and after this task's plugin change: the chip is dropped by
    // the ENGINE (the tri is applied in computeEffectiveProficiencies, committed on the
    // dnd5e side of this task) and the row is emitted by the TOOL_GROUPS section, which
    // carries "thieves'-tools" in OTHER_TOOLS. What it pins is that the two mechanisms do
    // not double up: `buildCandidates` claims a slug once through `seen`, so the suppressed
    // union cannot emit a second row for a value a vocabulary section already produced.
    const es = makeEditState();
    const { el } = openFor("tools", { ...TOOLS, overrides: { tools: { proficiency: { "thieves'-tools": "none" } } } }, es);
    expect(el.querySelector(`.pc-prof-modal-chip[data-prof="thieves'-tools"]`)).toBeNull();
    expect(el.querySelectorAll(`.pc-prof-modal-row[data-prof="thieves'-tools"]`).length).toBe(1);
  });

  it("a none override on an OFF-vocabulary DATA grant returns it through suppressed()", () => {
    // The discriminating fixture for the `suppressed()` extension: an off-vocabulary GRANT
    // plus the tri (never an `add`, because `addProficiency`'s own clearance keeps `add` and
    // `none` from coexisting). The entry's value is the RAW "Runic Cipher" (no vocabulary
    // hit); the tri branch suppresses toProfSlug("runic-cipher"); no TOOL_GROUPS section
    // carries it, so the off-vocabulary section is the ONLY producer of that row.
    //
    // The chip assertion is first by convention, but the KILL POWER is in the second: the
    // chip is gone either way (the engine dropped it), and only the `suppressed()` extension
    // can put the row back. Recorded as this task's one exception to first-expect-is-the-RED.
    const { el } = openFor("tools", {
      classes: [{ entity: { name: "Cipherer", proficiencies: { tools: { fixed: ["Runic Cipher"] } } }, level: 1, choices: {} }],
      overrides: { tools: { proficiency: { "runic-cipher": "none" } } },
    });
    expect(el.querySelector('.pc-prof-modal-chip[data-prof="Runic Cipher"]')).toBeNull();
    expect(el.querySelector('.pc-prof-modal-row[data-prof="runic-cipher"]')).not.toBeNull();
  });

  it("the languages domain renders NO tri control", () => {
    // A CONTROL: §9.3's closing sentence. Languages get no tri at any layer.
    const { el } = openFor("languages", { race: DWARF });
    expect(el.querySelector(".pc-prof-modal-tri")).toBeNull();
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
