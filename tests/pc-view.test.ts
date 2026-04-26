/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PCSheetView, VIEW_TYPE_PC } from "../src/modules/pc/pc.view";
import { PCModule } from "../src/modules/pc/pc.module";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { CoreAPI } from "../src/core/module-api";
import { WorkspaceLeaf } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

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

const PC_FILE = [
  "---",
  "archivist-type: pc",
  "---",
  "",
  "```pc",
  "name: Grendal",
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
  "```",
].join("\n");

function bootModule(): PCModule {
  const m = new PCModule();
  const entities = buildMockRegistry([{ slug: "bladesworn", entityType: "class", data: BLADESWORN }]);
  // PCModule.register() wires all sheet components; no `core.plugin` means
  // the file-open listener setup is skipped (tests run without a full host).
  m.register({ entities } as unknown as CoreAPI);
  return m;
}

describe("PCSheetView", () => {
  it("getViewType returns the canonical string", () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    expect(v.getViewType()).toBe(VIEW_TYPE_PC);
    expect(VIEW_TYPE_PC).toBe("archivist-pc-sheet");
  });

  it("renders a full sheet for a happy-path PC file", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    v.setViewData(PC_FILE, true);
    await v.rendered;
    expect(v.contentEl.querySelector(".archivist-pc-sheet")).not.toBeNull();
    expect(v.contentEl.querySelector(".pc-name")?.textContent).toBe("Grendal");
  });

  it("shows error panel when code block missing", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    v.setViewData("---\narchivist-type: pc\n---\n\njust prose.\n", true);
    await v.rendered;
    expect(v.contentEl.querySelector(".archivist-pc-error")).not.toBeNull();
    expect(v.contentEl.textContent).toContain("No `pc` code block");
  });

  it("shows error panel on parse failure", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    const bad = "```pc\nname: x\n```\n";
    v.setViewData(bad, true);
    await v.rendered;
    expect(v.contentEl.querySelector(".archivist-pc-error")).not.toBeNull();
  });

  it("renders warning banner when a slug can't resolve", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    const withBadRace = PC_FILE.replace("race: null", 'race: "[[ghost-elf]]"');
    v.setViewData(withBadRace, true);
    await v.rendered;
    expect(v.contentEl.querySelector(".archivist-pc-warnings")).not.toBeNull();
  });

  it("shows loading shim synchronously, then renders once compendiumsReady resolves", async () => {
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((r) => { resolveReady = r; });
    const m = bootModule();
    m.core = { ...m.core!, plugin: { compendiumsReady: readyPromise } } as typeof m.core;
    const v = new PCSheetView(new WorkspaceLeaf(), m);
    v.setViewData(PC_FILE, true);
    // Synchronously: only the shim is rendered; resolver.resolve() has NOT run
    // yet, so the sheet body is absent.
    expect(v.contentEl.querySelector(".pc-loading-shim")).not.toBeNull();
    expect(v.contentEl.querySelector(".archivist-pc-sheet")).toBeNull();
    // Resolve the gate; the sheet now renders and the shim is gone.
    resolveReady();
    await v.rendered;
    expect(v.contentEl.querySelector(".pc-loading-shim")).toBeNull();
    expect(v.contentEl.querySelector(".archivist-pc-sheet")).not.toBeNull();
  });

  it("onOpen adds 'Edit as Markdown' action", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    await v.onOpen();
    expect(
      (v as unknown as { actions: Array<{ title: string }> }).actions.some(
        (a) => a.title === "Edit as Markdown",
      ),
    ).toBe(true);
  });

  it("'Edit as Markdown' callback triggers setViewState(markdown)", async () => {
    const leaf = new WorkspaceLeaf();
    const v = new PCSheetView(leaf, bootModule());
    await v.onOpen();
    const action = (
      v as unknown as { actions: Array<{ title: string; callback: () => void }> }
    ).actions.find((a) => a.title === "Edit as Markdown")!;
    action.callback();
    await Promise.resolve();
    expect(leaf.lastSetViewState?.type).toBe("markdown");
  });

  it("getViewData returns the raw data passed to setViewData (read-only)", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    v.setViewData(PC_FILE, true);
    await v.rendered;
    expect(v.getViewData()).toBe(PC_FILE);
  });

  it("preserves the active tab across edit-state-triggered re-renders", async () => {
    // Reproduces the SP5 bug: clicking edit actions inside Inventory used to
    // silently switch the user back to the Actions tab because renderSheet()
    // empties the container and TabsContainer hardcoded the first tab as
    // active. After the fix, the tab the user was viewing must persist
    // across handleChange-driven re-renders.
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    v.setViewData(PC_FILE, true);
    await v.rendered;

    // Simulate the user clicking the Inventory tab.
    const inventoryBtn = v.contentEl.querySelector<HTMLButtonElement>(
      '.pc-tab-btn[data-tab="panel-inventory"]',
    );
    expect(inventoryBtn).not.toBeNull();
    inventoryBtn!.click();

    // Confirm Inventory is now active before mutation.
    const activeBefore = v.contentEl.querySelectorAll<HTMLElement>(".pc-tab-panel.active");
    expect(activeBefore.length).toBe(1);
    expect(activeBefore[0].id).toBe("panel-inventory");

    // Trigger a mutation through editState — this calls onChange ⇒
    // handleChange ⇒ renderSheet, which previously reset the tab.
    const editState = (v as unknown as { editState: { setCurrency(coin: string, n: number): void } }).editState;
    editState.setCurrency("gp", 7);

    const activeAfter = v.contentEl.querySelectorAll<HTMLElement>(".pc-tab-panel.active");
    expect(activeAfter.length).toBe(1);
    expect(activeAfter[0].id).toBe("panel-inventory");
  });

  it("resets the active tab to Actions when a different file is loaded", async () => {
    // Tab state is per-file: opening another PC should NOT carry the
    // previously-viewed tab over.
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    v.setViewData(PC_FILE, true);
    await v.rendered;

    v.contentEl.querySelector<HTMLButtonElement>('.pc-tab-btn[data-tab="panel-notes"]')!.click();
    expect(
      v.contentEl.querySelector<HTMLElement>(".pc-tab-panel.active")?.id,
    ).toBe("panel-notes");

    // Re-load the same view with fresh data (simulates a file switch).
    v.setViewData(PC_FILE, true);
    await v.rendered;

    expect(
      v.contentEl.querySelector<HTMLElement>(".pc-tab-panel.active")?.id,
    ).toBe("panel-actions");
  });
});
