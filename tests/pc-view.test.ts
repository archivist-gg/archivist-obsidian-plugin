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
    await v.setViewData(PC_FILE, true);
    expect(v.contentEl.querySelector(".archivist-pc-sheet")).not.toBeNull();
    expect(v.contentEl.querySelector(".pc-name")?.textContent).toBe("Grendal");
  });

  it("shows error panel when code block missing", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    await v.setViewData("---\narchivist-type: pc\n---\n\njust prose.\n", true);
    expect(v.contentEl.querySelector(".archivist-pc-error")).not.toBeNull();
    expect(v.contentEl.textContent).toContain("No `pc` code block");
  });

  it("shows error panel on parse failure", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    const bad = "```pc\nname: x\n```\n";
    await v.setViewData(bad, true);
    expect(v.contentEl.querySelector(".archivist-pc-error")).not.toBeNull();
  });

  it("renders warning banner when a slug can't resolve", async () => {
    const v = new PCSheetView(new WorkspaceLeaf(), bootModule());
    const withBadRace = PC_FILE.replace("race: null", 'race: "[[ghost-elf]]"');
    await v.setViewData(withBadRace, true);
    expect(v.contentEl.querySelector(".archivist-pc-warnings")).not.toBeNull();
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
    await v.setViewData(PC_FILE, true);
    expect(v.getViewData()).toBe(PC_FILE);
  });
});
