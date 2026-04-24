/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PCSheetView } from "../src/modules/pc/pc.view";
import { PCModule } from "../src/modules/pc/pc.module";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { GRENDAL_AFFLICTED_MD } from "./fixtures/pc/grendal-the-wary-afflicted";
import {
  HILL_FOLK,
  BLADESWORN as BLADESWORN_FULL,
  PATH_OF_SHADOW,
  DRIFTER,
  SURE_STEP,
  LONGSWORD,
} from "./fixtures/pc/grendal-the-wary";
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
  "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }",
  "equipment: []",
  "overrides: {}",
  "state:",
  "  hp: { current: 24, max: 24, temp: 0 }",
  "  hit_dice:",
  "    d10: { used: 0, total: 3 }",
  "  spell_slots: {}",
  "  concentration: null",
  "  conditions: []",
  "  inspiration: 0",
  "  exhaustion: 0",
  "```",
  "",
  "## Backstory",
  "",
  "The wary one.",
].join("\n");

async function bootView(): Promise<{ view: PCSheetView; mod: PCModule }> {
  const mod = new PCModule();
  const entities = buildMockRegistry([{ slug: "bladesworn", entityType: "class", data: BLADESWORN }]);
  mod.register({ entities } as unknown as CoreAPI);
  const view = new PCSheetView(new WorkspaceLeaf(), mod);
  view.setViewData(PC_FILE, true);
  await view.rendered;
  return { view, mod };
}

describe("PCSheetView — write path", () => {
  it("getViewData returns the raw file text before any mutation", async () => {
    const { view } = await bootView();
    const out = view.getViewData();
    expect(out).toContain("hp: { current: 24, max: 24, temp: 0 }");
    expect(out).toContain("## Backstory");
  });

  it("mutating via editState updates getViewData output and preserves markdown tail", async () => {
    const { view } = await bootView();
    // @ts-expect-error — access the view-owned edit state in test
    view.editState!.setInspiration(2);
    await Promise.resolve();
    const out = view.getViewData();
    expect(out).toMatch(/inspiration:\s*2/);
    expect(out.startsWith("---\narchivist-type: pc\n---")).toBe(true);
    expect(out.trimEnd().endsWith("The wary one.")).toBe(true);
  });

  it("setViewData no-ops when data === lastWrittenData (loop guard)", async () => {
    const { view } = await bootView();
    // @ts-expect-error
    view.editState!.setInspiration(5);
    await Promise.resolve();
    const echoed = view.getViewData();

    // Spy on handleChange to prove setViewData doesn't re-enter the pipeline.
    const hc = vi.spyOn(view as unknown as { handleChange: () => void }, "handleChange");
    view.setViewData(echoed, false);
    expect(hc).not.toHaveBeenCalled();
  });

  it("setViewData loop guard works across LF/CRLF echo (Windows simulation)", async () => {
    const { view } = await bootView();
    // @ts-expect-error
    view.editState!.setInspiration(7);
    await Promise.resolve();
    const lfBytes = view.getViewData();
    const crlfBytes = lfBytes.replace(/\n/g, "\r\n");  // simulate Obsidian Windows save
    const hc = vi.spyOn(view as unknown as { handleChange: () => void }, "handleChange");
    view.setViewData(crlfBytes, false);
    expect(hc).not.toHaveBeenCalled();
  });
});

describe("PCSheetView — write path on afflicted state", () => {
  async function bootAfflicted(): Promise<PCSheetView> {
    const mod = new PCModule();
    // Same stub set as tests/pc-integration.test.ts — the Grendal fixture
    // references these entity types via `[[slug]]` in its YAML.
    const entities = buildMockRegistry([
      { slug: "hill-folk", entityType: "race", data: HILL_FOLK },
      { slug: "bladesworn", entityType: "class", data: BLADESWORN_FULL },
      { slug: "path-of-shadow", entityType: "subclass", data: PATH_OF_SHADOW },
      { slug: "drifter", entityType: "background", data: DRIFTER },
      { slug: "sure-step", entityType: "feat", data: SURE_STEP },
      { slug: "longsword", entityType: "item", data: LONGSWORD },
    ]);
    mod.register({ entities } as unknown as CoreAPI);
    const view = new PCSheetView(new WorkspaceLeaf(), mod);
    view.setViewData(GRENDAL_AFFLICTED_MD, true);
    await view.rendered;
    return view;
  }

  it("heals Grendal and writes out updated YAML preserving conditions and exhaustion", async () => {
    const view = await bootAfflicted();
    // @ts-expect-error — access the view-owned edit state in test
    view.editState!.heal(10);
    await Promise.resolve();
    const out = view.getViewData();
    expect(out).toMatch(/current:\s*10/);        // was 0, +10
    expect(out).toMatch(/poisoned/);             // conditions preserved
    expect(out).toMatch(/frightened/);
    expect(out).toMatch(/exhaustion:\s*1/);      // exhaustion preserved
    // Heal crossed HP=0 → >0, so death saves were auto-cleared:
    expect(out).toMatch(/death_saves[^}]*successes:\s*0[^}]*failures:\s*0/);
  });

  it("toggling a condition updates conditions list in written YAML", async () => {
    const view = await bootAfflicted();
    // @ts-expect-error
    view.editState!.toggleCondition("poisoned");
    await Promise.resolve();
    const out = view.getViewData();
    expect(out).not.toMatch(/poisoned/);
    expect(out).toMatch(/frightened/);
  });
});

describe("PCSheetView — error boundary + lifecycle", () => {
  it("handleChange logs and requests save even if renderSheet throws", async () => {
    const { view } = await bootView();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Force the next renderSheet to throw by monkey-patching:
    const renderSheet = (view as unknown as { renderSheet: (w: string[]) => void }).renderSheet.bind(view);
    (view as unknown as { renderSheet: (w: string[]) => void }).renderSheet = () => {
      throw new Error("boom");
    };
    const requestSaveSpy = vi.spyOn(view, "requestSave");

    // @ts-expect-error — mutate via the view-owned edit state
    view.editState!.setInspiration(9);
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalled();
    expect(requestSaveSpy).toHaveBeenCalled();  // save still fires
    errorSpy.mockRestore();
    // restore renderSheet so afterEach doesn't cascade
    (view as unknown as { renderSheet: (w: string[]) => void }).renderSheet = renderSheet;
  });

  it("onLoadFile clears editState and lastWrittenData for a fresh file", async () => {
    const { view } = await bootView();
    // @ts-expect-error
    view.editState!.setInspiration(5);
    await Promise.resolve();
    expect(view.getViewData()).toMatch(/inspiration:\s*5/);  // dirty + spliced

    // Simulate Obsidian switching to a different file:
    const fakeFile = { path: "other.md", basename: "other" } as unknown as import("obsidian").TFile;
    await view.onLoadFile(fakeFile);

    // State should have been reset.
    // @ts-expect-error — access private
    expect(view.editState).toBeNull();
    // @ts-expect-error
    expect(view.lastWrittenData).toBeNull();
    // @ts-expect-error
    expect(view.isDirty).toBe(false);
  });
});
