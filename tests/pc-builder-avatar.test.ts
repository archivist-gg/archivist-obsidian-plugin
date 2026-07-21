/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PCSheetView } from "../packages/obsidian/src/modules/pc/pc.view";
import { PCModule } from "../packages/obsidian/src/modules/pc/pc.module";
import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { PCServices } from "../packages/obsidian/src/modules/pc/pc.services";
import { WorkspaceLeaf } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

const DRAFT_FILE = [
  "---", "archivist-type: pc", "---", "", "```pc",
  "name: Draft", "edition: '2014'", "builder: true",
  "race: null", "subrace: null", "background: null", "class: []",
  "abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }",
  "ability_method: manual", "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }", "equipment: []", "overrides: {}",
  "state:", "  hp: { current: 0, max: 0, temp: 0 }",
  "```", "",
].join("\n");

async function renderBuilder(portraitUrl: string | null): Promise<HTMLElement> {
  const mod = new PCModule();
  // Builder boot path reaches entity-picker.ts -> ctx.services.compendiums.getAll();
  // a bare { entities } stub crashes at `await view.rendered` (Gate 2 BLOCKER fix,
  // stub mirrors tests/pc-sheet-builder-branch.test.ts).
  mod.init({
    entities: buildMockRegistry([]),
    compendiums: { getAll: () => [] },
    modules: { getByEntityType: () => undefined },
    plugin: {},
  } as unknown as PCServices);
  const view = new PCSheetView(new WorkspaceLeaf(), mod);
  view.setViewData(DRAFT_FILE, true);
  await view.rendered;
  const v = view as unknown as { character: unknown; derived: unknown };
  const root = document.createElement("div");
  renderPCSheet({
    root: root as never, resolved: v.character as never, derived: v.derived as never,
    registry: mod.registry, services: mod.services!, app: {} as never,
    editState: null, warnings: [], portraitUrl,
  });
  return root;
}

describe("builder topbar mini avatar", () => {
  it("shows the d20 icon when no portrait", async () => {
    const root = await renderBuilder(null);
    const av = root.querySelector(".pc-builder-avatar");
    expect(av).toBeTruthy();
    expect(av!.querySelector("svg")).toBeTruthy();
    expect(av!.querySelector("img")).toBeNull();
  });
  it("mirrors the portrait img when set", async () => {
    const root = await renderBuilder("app://local/x.png");
    const img = root.querySelector(".pc-builder-avatar img.pc-avatar-img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("app://local/x.png");
  });
});
