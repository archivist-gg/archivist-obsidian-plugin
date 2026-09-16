/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

// Entries as the engine can ACTUALLY emit them: the grant path always seeds
// `sources: [g.source]`, and only a pick yields an empty `sources` (with
// `origin: "pick"`). An earlier version of this mock combined `origin: "grant"`
// with `sources: []`, a shape no engine path produces · the panel reads only
// `label`, so it was harmless, but a faithful fixture is the only kind an
// assertion about provenance could ever be added to.
// `choices` is deliberately ABSENT: the sheet no longer renders the "choose N"
// placeholder at all (spec R4-P3b §9). Unspent picks are the builder's subject.
/** A `vi.fn` rather than a bare arrow so ONE test can queue a different return
 *  with `mockReturnValueOnce` (the all-empty aggregate that re-pins "None").
 *  Every other test gets this default implementation. */
const mockAggregate = vi.hoisted(() => vi.fn((): {
  armor: object[]; weapons: object[]; tools: object[]; languages: object[];
} => ({
  armor: [{ value: "light", label: "Light", sources: ["Rogue"], origin: "grant" }],
  weapons: [
    { value: "hand-crossbows", label: "Hand Crossbows", sources: ["Rogue"], origin: "grant" },
    { value: "rapiers", label: "Rapiers", sources: ["Rogue"], origin: "grant" },
  ],
  // R4-G4 §9.2: one expertise tool and one plain one. This mock is module-level
  // and hoisted, so it reaches EVERY test in the file: the "None" pin that used
  // to sit on Tools moved when this bucket stopped being empty.
  tools: [
    { value: "thieves'-tools", label: "Thieves' Tools", sources: ["Rogue"], origin: "grant", expertise: true },
    { value: "herbalism-kit", label: "Herbalism Kit", sources: ["Hermit"], origin: "grant" },
  ],
  languages: [{ value: "common", label: "Common", sources: ["Human"], origin: "grant" }],
})));
vi.mock("@archivist-gg/dnd5e/pc/pc.proficiencies", () => ({
  aggregateProficiencies: mockAggregate,
}));

/** The modal is stubbed so this stays a PANEL test: what the panel owes is a
 *  call to `openProficiencyModal(ctx, domain)` from the right rows and an
 *  unconditional `refreshProficiencyModal(ctx)` before it paints anything. The
 *  modal's own behaviour is pinned by tests/pc-proficiency-edit-modal.test.ts. */
const spy = vi.hoisted(() => ({
  open: [] as { ctx: unknown; domain: string }[],
  refreshCtx: [] as unknown[],
  /** One entry per refresh call, recording how many children the mount point
   *  already had · 0 proves the call ran BEFORE the panel drew anything. */
  refreshAtChildCount: [] as number[],
  /** Set by `render` so the refresh stub can measure the mount point. */
  mount: null as HTMLElement | null,
}));
vi.mock("../packages/obsidian/src/modules/pc/components/proficiency-edit-modal", () => ({
  openProficiencyModal: (ctx: unknown, domain: string) => {
    spy.open.push({ ctx, domain });
  },
  refreshProficiencyModal: (ctx: unknown) => {
    spy.refreshCtx.push(ctx);
    spy.refreshAtChildCount.push(spy.mount?.childElementCount ?? -1);
  },
  closeProficiencyModal: () => {},
}));

import { ProficienciesPanel } from "../packages/obsidian/src/modules/pc/components/proficiencies-panel";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => {
  spy.open.length = 0;
  spy.refreshCtx.length = 0;
  spy.refreshAtChildCount.length = 0;
  spy.mount = null;
});

const baseCtx = {
  resolved: {} as ResolvedCharacter,
  derived: {} as never,
  services: {} as never,
  app: {} as never,
};

/** The historical fixture: no editState, so no row is editable. */
const ctx: ComponentRenderContext = { ...baseCtx, editState: null } as ComponentRenderContext;

/** A sheet in edit mode · the ONLY state in which rows become clickable.
 *  Asserting a click against `ctx` above would target rows that were never
 *  wired, and would pass for the wrong reason. */
const editCtx: ComponentRenderContext = {
  ...baseCtx,
  editState: {} as CharacterEditState,
} as ComponentRenderContext;

function render(c: ComponentRenderContext): HTMLElement {
  const container = mountContainer();
  spy.mount = container;
  new ProficienciesPanel().render(container, c);
  return container;
}

function lineFor(container: HTMLElement, label: string): HTMLElement {
  const lines = [...container.querySelectorAll(".pc-prof-line")] as HTMLElement[];
  const line = lines.find((l) => l.querySelector(".pc-prof-key")?.textContent === `${label}: `);
  if (!line) throw new Error(`no proficiency line for ${label}`);
  return line;
}

function valueFor(container: HTMLElement, label: string): string {
  return lineFor(container, label).querySelector(".pc-prof-vals")?.textContent ?? "";
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("ProficienciesPanel", () => {
  it("renders items comma-joined, with no choice placeholder", () => {
    const container = render(ctx);

    expect(valueFor(container, "Weapons")).toBe("Hand Crossbows, Rapiers");
    expect(valueFor(container, "Languages")).toBe("Common");
    // The MOVED PIN (R4-G4 T9): this read "None" until the hoisted mock's tools
    // bucket gained the §9.2 fixture. "None" is re-pinned below, in the
    // all-empty test, on all four lines.
    expect(valueFor(container, "Tools")).toBe("Thieves' Tools, Herbalism Kit");
    expect(valueFor(container, "Armor")).toBe("Light");
  });

  it("R4-G4 §9.2: the expertise marker lands OUTSIDE edit mode too", () => {
    // The edit-mode test below reaches the tools line through
    // `[data-prof-domain="tools"]`, an attribute the panel only sets on an
    // editable row · so it cannot say anything about the state the sheet spends
    // most of its life in. The class rides the ENTRY, not the row handler, and
    // this is the assertion that says so (review M-4).
    // `Array.from`, never a spread: this file's `lib` has no DOM.Iterable.
    const container = render(ctx);
    const spans = Array.from(lineFor(container, "Tools").querySelectorAll(".pc-prof-val"));
    expect(spans.map((s) => [s.textContent, s.classList.contains("expertise")]))
      .toEqual([["Thieves' Tools", true], ["Herbalism Kit", false]]);
    expect(container.querySelectorAll(".pc-prof-line.editable")).toHaveLength(0);
  });

  it("renders 'None' for every bucket the aggregate leaves empty", () => {
    // The tools pin above used to carry this word. It moved when the hoisted
    // mock's tools bucket gained the §9.2 fixture, so the shipped "None" wording
    // is re-pinned HERE, on an aggregate whose four buckets are all empty ·
    // otherwise nothing in the file asserts it any more.
    mockAggregate.mockReturnValueOnce({ armor: [], weapons: [], tools: [], languages: [] });
    const container = render(ctx);
    for (const label of ["Armor", "Weapons", "Tools", "Languages"]) {
      expect(valueFor(container, label)).toBe("None");
    }
  });

  it("renders no em-dash (U+2014) anywhere in the panel subtree", () => {
    const container = render(ctx);
    expect(container.textContent).not.toContain("\u2014");
  });

  it("refreshes an open modal unconditionally, before painting, on every render", () => {
    render(ctx);
    // Called even with editState null: refreshProficiencyModal already no-ops
    // when nothing is open, so the panel must not duplicate that check.
    expect(spy.refreshCtx).toHaveLength(1);
    expect(spy.refreshCtx[0]).toBe(ctx);
    // 0 children at call time · the refresh ran at the TOP of render(). It is
    // also what re-runs the modal's updateDynamic after a chip/row click, so a
    // refresh made after the paint would leave a stale candidate list behind.
    expect(spy.refreshAtChildCount).toEqual([0]);

    render(editCtx);
    expect(spy.refreshCtx).toHaveLength(2);
    expect(spy.refreshCtx[1]).toBe(editCtx);
    expect(spy.refreshAtChildCount).toEqual([0, 0]);
  });

  describe("with an editState", () => {
    it("marks Tools and Languages editable and tags each with its domain", () => {
      const container = render(editCtx);

      for (const [label, domain] of [["Tools", "tools"], ["Languages", "languages"]] as const) {
        const line = lineFor(container, label);
        expect(line.classList.contains("editable")).toBe(true);
        expect(line.getAttribute("data-prof-domain")).toBe(domain);
      }
    });

    it("opens the modal for the clicked domain", () => {
      const container = render(editCtx);

      // The selector the live verification drives. A bare `.pc-prof-line.editable`
      // would hit Tools, which the panel emits first.
      const languages = container.querySelector(
        '.pc-prof-line.editable[data-prof-domain="languages"]',
      ) as HTMLElement;
      click(languages);
      click(lineFor(container, "Tools"));

      expect(spy.open.map((c) => c.domain)).toEqual(["languages", "tools"]);
      // Identity, not shape: the handler must close over the ctx it was drawn
      // with, which is what makes the modal repaint from the live character.
      expect(spy.open.every((c) => c.ctx === editCtx)).toBe(true);
    });

    it("R4-G4 §9.2: the tools line marks the expertise entry and leaves the plain one unmarked; the languages line is byte-unchanged", () => {
      // `editCtx`, not `ctx`: `data-prof-domain` is only set on an editable row,
      // so the brief's selector needs a sheet in edit mode. The marker itself is
      // independent of edit mode · it rides the entry, not the row's handler.
      const container = render(editCtx);
      const spans = Array.from(container.querySelectorAll('[data-prof-domain="tools"] .pc-prof-val'));
      expect(spans.map((s) => [s.textContent, s.classList.contains("expertise")]))
        .toEqual([["Thieves' Tools", true], ["Herbalism Kit", false]]);
      // The whole line still reads exactly as it did before the spans existed:
      // the same labels, the same ", " separator, no stray whitespace.
      expect(container.querySelector('[data-prof-domain="languages"] .pc-prof-vals')!.textContent).toBe("Common");
      expect(valueFor(container, "Tools")).toBe("Thieves' Tools, Herbalism Kit");
    });

    it("leaves Armor and Weapons inert: no class, no domain attribute, no handler", () => {
      const container = render(editCtx);

      for (const label of ["Armor", "Weapons"]) {
        const line = lineFor(container, label);
        expect(line.classList.contains("editable")).toBe(false);
        expect(line.getAttribute("data-prof-domain")).toBeNull();
        click(line);
      }
      expect(spy.open).toEqual([]);
    });
  });

  it("makes no row clickable without an editState", () => {
    const container = render(ctx);

    expect(container.querySelectorAll(".pc-prof-line.editable")).toHaveLength(0);
    for (const label of ["Armor", "Weapons", "Tools", "Languages"]) {
      const line = lineFor(container, label);
      expect(line.getAttribute("data-prof-domain")).toBeNull();
      click(line);
    }
    expect(spy.open).toEqual([]);
  });
});
