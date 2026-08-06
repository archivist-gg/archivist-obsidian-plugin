/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PCSheetView } from "../packages/obsidian/src/modules/pc/pc.view";
import { PCModule } from "../packages/obsidian/src/modules/pc/pc.module";
import { closeDefenseTypePopover } from "../packages/obsidian/src/modules/pc/components/defense-type-popover";
import { closeConditionsPopover } from "../packages/obsidian/src/modules/pc/components/conditions-popover";
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
  }
});

/**
 * The FIFTH site, and not one of the view's teardown hooks: the header gear
 * calls `editState.openBuilder()`, which flips `builder: true` and re-renders
 * IN PLACE · no setViewData, no clear, no onunload, no onLoadFile. The builder
 * branch of `renderPCSheet` returns before `defenses-conditions-panel` renders,
 * so `refreshDefenseTypePopover` is never reached on that render or on any
 * later builder render, and `root.empty()` has already detached the `+` the
 * picker is bound to.
 *
 * This is exercised through the REAL view rather than through `renderPCSheet`
 * directly, so it also measures that none of the four hooks above happens to
 * cover it. Its spy-level twin lives in tests/pc-sheet-builder-coin-close.test.ts,
 * beside the coin/proficiency closes it copies · that one also carries the
 * negative case, that a NON-builder render closes neither popover.
 */
describe("builder entry closes the defenses popovers", () => {
  it("removes an open defense picker when the header gear reopens the builder", async () => {
    const { view } = await bootView();
    openDefensePicker(view);
    (view as unknown as { editState: { openBuilder(): void } }).editState.openBuilder();
    expect(view.contentEl.querySelector(".pc-def-cond")).toBeNull();  // builder shell is up
    expect(document.body.querySelector(".pc-def-popover")).toBeNull();
  });

  it("removes an open conditions popover when the header gear reopens the builder", async () => {
    const { view } = await bootView();
    openConditions(view);
    (view as unknown as { editState: { openBuilder(): void } }).editState.openBuilder();
    expect(view.contentEl.querySelector(".pc-def-cond")).toBeNull();
    expect(document.body.querySelector(".pc-cond-popover")).toBeNull();
  });
});
