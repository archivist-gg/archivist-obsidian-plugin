/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PCSheetView } from "../packages/obsidian/src/modules/pc/pc.view";
import { PCModule } from "../packages/obsidian/src/modules/pc/pc.module";
import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { PCServices } from "../packages/obsidian/src/modules/pc/pc.services";
import type { CropParams } from "../packages/obsidian/src/modules/pc/pc.portrait";
import { WorkspaceLeaf } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

const BLADESWORN = {
  slug: "bladesworn", name: "Bladesworn", edition: "2014", hit_die: "d10",
  primary_abilities: ["str"], saving_throws: ["str", "con"],
  features_by_level: { 1: [{ name: "Sworn Blade" }] },
  proficiencies: { armor: ["light"], weapons: { fixed: [] }, tools: { fixed: [] } },
};
const PC_FILE = [
  "---", "archivist-type: pc", "---", "", "```pc",
  "name: Grendal", "edition: '2014'", "race: null", "subrace: null", "background: null",
  "class:", "  - name: '[[bladesworn]]'", "    level: 3", "    subclass: null", "    choices: {}",
  "abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }",
  "ability_method: manual", "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }", "equipment: []", "overrides: {}",
  "state:", "  hp: { current: 24, max: 24, temp: 0 }",
  "  hit_dice:", "    d10: { used: 0, total: 3 }",
  "  spell_slots: {}", "  concentration: null", "  conditions: []",
  "  inspiration: 0", "  exhaustion: 0",
  "```", "",
].join("\n");

async function bootSheetParts() {
  const mod = new PCModule();
  const entities = buildMockRegistry([{ slug: "bladesworn", entityType: "class", data: BLADESWORN }]);
  mod.init({ entities } as unknown as PCServices);
  const view = new PCSheetView(new WorkspaceLeaf(), mod);
  view.setViewData(PC_FILE, true);
  await view.rendered;
  const v = view as unknown as { character: unknown; derived: unknown };
  return { mod, view, resolved: v.character, derived: v.derived };
}

function renderWith(portraitUrl: string | null, portraitCrop: CropParams | null) {
  return bootSheetParts().then(({ mod, resolved, derived }) => {
    const root = document.createElement("div");
    installObsidianDomHelpers();
    renderPCSheet({
      root: root as never,
      resolved: resolved as never,
      derived: derived as never,
      registry: mod.registry,
      services: mod.services!,
      app: {} as never,
      editState: null,
      warnings: [],
      portraitUrl,
      portraitCrop,
    });
    return root;
  });
}

describe("header portrait crop rendering", () => {
  it("threads portraitCrop into a cropped avatar with CSS custom props", async () => {
    const root = await renderWith("app://local/x.png", { x: 0.2, y: 0.3, size: 0.6 });
    const btn = root.querySelector("button.pc-avatar") as HTMLElement;
    expect(btn.classList.contains("pc-avatar-cropped")).toBe(true);
    expect(btn.style.getPropertyValue("--pc-crop-w")).toBe(String(1 / 0.6));
    expect(btn.style.getPropertyValue("--pc-crop-x")).toBe(String(0.2 / 0.6));
    expect(btn.style.getPropertyValue("--pc-crop-y")).toBe(String(0.3 / 0.6));
    expect(btn.querySelector("img.pc-avatar-img")).toBeTruthy();
  });
  it("no crop -> no cropped class, no props (cover path unchanged)", async () => {
    const root = await renderWith("app://local/x.png", null);
    const btn = root.querySelector("button.pc-avatar") as HTMLElement;
    expect(btn.classList.contains("pc-avatar-cropped")).toBe(false);
    expect(btn.style.getPropertyValue("--pc-crop-w")).toBe("");
  });
  it("crop without url renders the d20 (crop ignored)", async () => {
    const root = await renderWith(null, { x: 0, y: 0, size: 0.5 });
    expect(root.querySelector("button.pc-avatar svg")).toBeTruthy();
    expect(root.querySelector("button.pc-avatar img")).toBeNull();
  });
});

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

async function renderBuilder(portraitUrl: string | null, portraitCrop: CropParams | null): Promise<HTMLElement> {
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
    editState: null, warnings: [], portraitUrl, portraitCrop,
  });
  return root;
}

describe("builder mini avatar crop rendering", () => {
  it("mirrors the crop on .pc-builder-avatar", async () => {
    const root = await renderBuilder("app://local/x.png", { x: 0.2, y: 0.3, size: 0.6 });
    const av = root.querySelector(".pc-builder-avatar") as HTMLElement;
    expect(av.classList.contains("pc-avatar-cropped")).toBe(true);
    expect(av.style.getPropertyValue("--pc-crop-w")).toBe(String(1 / 0.6));
    expect(av.querySelector("img.pc-avatar-img")).toBeTruthy();
  });
});
