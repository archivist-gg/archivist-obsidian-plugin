/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PCSheetView } from "../packages/obsidian/src/modules/pc/pc.view";
import { PCModule } from "../packages/obsidian/src/modules/pc/pc.module";
import { closeDefenseTypePopover } from "../packages/obsidian/src/modules/pc/components/defense-type-popover";
import { closeConditionsPopover } from "../packages/obsidian/src/modules/pc/components/conditions-popover";
import {
  allTicked, closeCompendiumFilterPopover, renderCompendiumFilter,
} from "../packages/obsidian/src/modules/pc/components/builder/compendium-filter";
import type { Compendium } from "../packages/obsidian/src/shared/entities/compendium-manager";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { PCServices } from "../packages/obsidian/src/modules/pc/pc.services";
import { WorkspaceLeaf } from "obsidian";
import type { TFile } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

// Both popovers render into `activeDocument.body`, NOT into the view's
// contentEl, so a leaked one from a previous case would still be there for the
// next one to find.
afterEach(() => {
  closeDefenseTypePopover();
  closeConditionsPopover();
  closeCompendiumFilterPopover();
});

const BLADESWORN = {
  slug: "bladesworn",
  name: "Bladesworn",
  edition: "2014",
  hit_die: "d10",
  primary_abilities: ["str"],
  saving_throws: ["str", "con"],
  features_by_level: { 1: [{ name: "Sworn Blade" }] },
  proficiencies: { armor: ["light"], weapons: { fixed: [] }, tools: { fixed: [] } },
};

function pcFile(name: string, inspiration: number): string {
  return [
    "---",
    "archivist-type: pc",
    "---",
    "",
    "```pc",
    `name: ${name}`,
    "edition: '2014'",
    "race: null",
    "subrace: null",
    "background: null",
    "class:",
    "  - name: '[[bladesworn]]'",
    "    level: 3",
    "    subclass: null",
    "    choices: {}",
    "abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }",
    "ability_method: manual",
    "state:",
    "  hp: { current: 24, max: 24, temp: 0 }",
    `  inspiration: ${inspiration}`,
    "```",
  ].join("\n");
}

const PC_FILE = pcFile("Grendal", 0);
/** Genuinely different bytes from PC_FILE, so `setViewData`'s loop guard cannot
 *  swallow the switch · the guard is what makes a save echo NOT a teardown. */
const OTHER_PC_FILE = pcFile("Vaelin", 1);

interface Booted {
  view: PCSheetView;
  /**
   * Leave the NEXT `setViewData`'s deferred render permanently pending, by
   * swapping in a `compendiumsReady` that never resolves. `setViewData` re-reads
   * that promise on every call, so this only affects calls made after it.
   *
   * This models COLD START, where `compendiumsReady` is genuinely outstanding
   * while the loading shim is up · and it is what makes the `setViewData` case
   * able to fail at all. `setViewData` nulls `this.editState` synchronously but
   * DEFERS the re-render, and that render's `refreshDefenseTypePopover` closes
   * the picker by itself on the editState-identity check. Measured: with the
   * render allowed to run, "setViewData removes an open defense picker" passes
   * against the unfixed view, i.e. it measures the repaint hook rather than the
   * teardown hook. Stalling the render leaves the teardown hook as the only
   * thing that can close it.
   */
  stallNextRender: () => void;
}

async function bootView(): Promise<Booted> {
  const mod = new PCModule();
  const entities = buildMockRegistry([{ slug: "bladesworn", entityType: "class", data: BLADESWORN }]);
  mod.init({ entities } as unknown as PCServices);
  const plugin: { compendiumsReady: Promise<void> } = { compendiumsReady: Promise.resolve() };
  mod.services = { ...mod.services!, plugin } as typeof mod.services;
  const view = new PCSheetView(new WorkspaceLeaf(), mod);
  view.setViewData(PC_FILE, true);
  await view.rendered;
  return {
    view,
    stallNextRender: () => {
      plugin.compendiumsReady = new Promise<void>(() => {});
    },
  };
}

/** Open the REAL defense picker the way a user does · through the panel's `+`.
 *  Nothing is stubbed: the assertion is that the popover NODE left the document,
 *  not that some spy was called. */
function openDefensePicker(view: PCSheetView): void {
  const add = view.contentEl.querySelector<HTMLButtonElement>(".pc-def-add-main");
  if (!add) throw new Error("defense + button not rendered");
  add.click();
  if (!document.body.querySelector(".pc-def-popover")) throw new Error("defense picker did not open");
}

function openConditions(view: PCSheetView): void {
  const add = view.contentEl.querySelector<HTMLButtonElement>(".pc-cond-add");
  if (!add) throw new Error("conditions + button not rendered");
  add.click();
  if (!document.body.querySelector(".pc-cond-popover")) throw new Error("conditions popover did not open");
}

/** Open a REAL compendium filter popover. It is the builder pickers' popover,
 *  and this fixture's sheet has no two-compendium pick to host one, so the
 *  filter is mounted on its own: what the hooks must close is the body-level
 *  node (and its pushed keymap scope), whichever picker opened it. */
function openCompendiumFilter(): void {
  const host = document.body.createDiv();
  const compendiums = ["A", "B"].map((name) =>
    ({ name, description: "", readonly: true, homebrew: false, folderPath: "" }) as Compendium);
  renderCompendiumFilter(host, {
    compendiums, counts: new Map([["A", 1], ["B", 1]]), state: allTicked(compendiums), onChange: () => {},
  });
  host.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
  if (!document.body.querySelector(".pc-bfilter-pop")) throw new Error("compendium filter did not open");
  // The popover lives on the body, not in the host: the host has done its job.
  host.remove();
}

/**
 * The four teardown hooks on `PCSheetView`, named by enclosing method. They are
 * the same four that already close the four sheet-owned modals, and the popovers
 * are subject to the identical hazard (R4-P1's class): each hook either discards
 * `this.editState` or unloads the view outright, while a surviving popover goes
 * on writing through the edit state it captured at open time · writes that
 * nothing will ever persist.
 */
const HOOKS: ReadonlyArray<readonly [string, (v: PCSheetView) => void | Promise<void>]> = [
  ["setViewData", (v) => { v.setViewData(OTHER_PC_FILE, false); }],
  ["clear", (v) => { v.clear(); }],
  ["onunload", (v) => { v.onunload(); }],
  ["onLoadFile", (v) => v.onLoadFile({ path: "other.md", basename: "other" } as unknown as TFile)],
] as const;

describe("PCSheetView tears down the defenses popovers", () => {
  for (const [hook, run] of HOOKS) {
    it(`${hook} removes an open defense picker from the document`, async () => {
      const { view, stallNextRender } = await bootView();
      openDefensePicker(view);
      stallNextRender();
      await run(view);
      expect(document.body.querySelector(".pc-def-popover")).toBeNull();
    });

    it(`${hook} removes an open conditions popover from the document`, async () => {
      const { view, stallNextRender } = await bootView();
      openConditions(view);
      stallNextRender();
      await run(view);
      expect(document.body.querySelector(".pc-cond-popover")).toBeNull();
    });

    it(`${hook} removes an open compendium filter popover from the document`, async () => {
      const { view, stallNextRender } = await bootView();
      openCompendiumFilter();
      stallNextRender();
      await run(view);
      expect(document.body.querySelector(".pc-bfilter-pop")).toBeNull();
    });
  }
});

/**
 * The FIFTH site, and not one of the view's teardown hooks: `openBuilder()`
 * flips `builder: true` and re-renders IN PLACE · no setViewData, no clear, no
 * onunload, no onLoadFile. The builder branch of `renderPCSheet` returns before
 * `defenses-conditions-panel` renders, so `refreshDefenseTypePopover` is never
 * reached on that render or on any later builder render, and `root.empty()` has
 * already detached the `+` the picker is bound to.
 *
 * ⚠️ WHAT THESE TWO CASES DO AND DO NOT MEASURE. They call
 * `editState.openBuilder()` DIRECTLY, so what they pin is exactly this: no
 * PCSheetView teardown hook covers the openBuilder path. They are named for
 * that and must not be read as reproducing a user gesture.
 *
 * They do NOT establish a live user-facing regression, and an earlier draft of
 * these names claimed the header gear, which would have. The gear's listener
 * (header-section.ts) is `openBuilder`'s only caller and does not
 * stopPropagation, so in an ATTACHED DOM that click keeps bubbling to
 * `activeDocument` and both popovers close themselves at the end of the same
 * dispatch. This fixture cannot see that: the obsidian mock's ItemView builds
 * `contentEl` with `document.createElement` and never attaches it, so
 * `contentEl.isConnected` is false and no click from inside it ever reaches
 * `activeDocument`. Measured with the builder-branch closes removed: detached
 * leaves the picker up, attached does not. R4-P5 task 14 settles it live.
 *
 * The spy-level twin lives in tests/pc-sheet-builder-coin-close.test.ts, beside
 * the coin/proficiency closes it copies · that one also carries the negative
 * case, that a NON-builder render closes neither popover.
 */
describe("openBuilder is a fifth teardown site, covered by no view hook", () => {
  it("openBuilder() called directly removes an open defense picker from the document", async () => {
    const { view } = await bootView();
    openDefensePicker(view);
    (view as unknown as { editState: { openBuilder(): void } }).editState.openBuilder();
    expect(view.contentEl.querySelector(".pc-def-cond")).toBeNull();  // builder shell is up
    expect(document.body.querySelector(".pc-def-popover")).toBeNull();
  });

  it("openBuilder() called directly removes an open conditions popover from the document", async () => {
    const { view } = await bootView();
    openConditions(view);
    (view as unknown as { editState: { openBuilder(): void } }).editState.openBuilder();
    expect(view.contentEl.querySelector(".pc-def-cond")).toBeNull();
    expect(document.body.querySelector(".pc-cond-popover")).toBeNull();
  });
});
