/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

// P4b T7 framing regression. jsdom has no layout, so this encodes the live
// numbers as a CSS-source contract (pattern: pc-ac-tooltip.test.ts).
//
// Live defect (2026-07-21, vault DnD, Test.md): 681x492 photo, stored crop
// "0.1680,0.0640,0.6237" -> --pc-crop-w = 1/0.6237 = 160.33% of the 92px
// avatar box = 147.5px expected img width. Obsidian's app.css rule
// `.workspace-leaf-content img:not([width]) { max-width: 100% }` clamped the
// used width to 92.34px (height auto -> 66.71px), leaving ~23px right and
// ~35px bottom parchment. max-width ALWAYS beats width, whatever the
// specificity, so every crop with size < 1 breaks unless the crop rule
// explicitly neutralizes the clamp with `max-width: none`.
// (Earlier synthetic pass was a blind spot: a tall 400x600 image's full-width
// square crop has size = 1.0 -> width 100% -> the clamp was exactly inert.)
describe("cropped avatar CSS neutralizes host img max-width clamp", () => {
  const stylesDir = resolve(__dirname, "../packages/obsidian/src/modules/pc/styles");

  const cropRuleOf = (file: string, selector: string): string => {
    const css = readFileSync(resolve(stylesDir, file), "utf8");
    const match = css.match(new RegExp(selector.replace(/[.\\[\]()]/g, "\\$&") + "\\s*\\{([^}]+)\\}"));
    expect(match, `${selector} rule missing from ${file}`).toBeTruthy();
    return (match as RegExpMatchArray)[1];
  };

  it("header avatar crop rule declares the width upscale AND max-width: none", () => {
    const body = cropRuleOf("components.css", ".archivist-pc-sheet .pc-avatar.pc-avatar-cropped .pc-avatar-img");
    // The upscale that the host clamp would defeat: size 0.6237 -> 160.33% > 100%.
    expect(body).toMatch(/width:\s*calc\(var\(--pc-crop-w\)\s*\*\s*100%\)/);
    expect(body).toMatch(/max-width:\s*none/);
  });

  it("builder mini avatar crop rule declares the width upscale AND max-width: none", () => {
    const body = cropRuleOf("builder.css", ".archivist-pc-sheet .pc-builder-avatar.pc-avatar-cropped .pc-avatar-img");
    expect(body).toMatch(/width:\s*calc\(var\(--pc-crop-w\)\s*\*\s*100%\)/);
    expect(body).toMatch(/max-width:\s*none/);
  });

  // P4b T7 "avatar oval" regression. Live defect (2026-07-22, vault DnD,
  // Test.md): a WIDE 2816x1536 image, right-border crop "0.4546,0,0.5454" ->
  // cropped img element measured 169.31px wide x 92.34px tall inside the 92px
  // avatar box. The base ".pc-avatar-img { border-radius: 50% }" rule (a
  // harmless circle only while the img is a SQUARE cover) leaked onto this
  // NON-square cropped img, painting it as a flat ellipse (rx 84.65, ry 46.17)
  // that curved inside the circular host box -> ~35% parchment crescent on the
  // side ("left/right of an oval"). The circular mask must come ONLY from the
  // host box (overflow: hidden + border-radius: 50%), so the cropped img must
  // neutralize the inherited radius. Center/cover crops were unaffected because
  // that path keeps the square base img (crop === null, no cropped class).
  it("header avatar crop rule resets border-radius so the non-square img is not an ellipse", () => {
    const body = cropRuleOf("components.css", ".archivist-pc-sheet .pc-avatar.pc-avatar-cropped .pc-avatar-img");
    expect(body).toMatch(/border-radius:\s*0/);
  });

  it("builder mini avatar crop rule resets border-radius so the non-square img is not an ellipse", () => {
    const body = cropRuleOf("builder.css", ".archivist-pc-sheet .pc-builder-avatar.pc-avatar-cropped .pc-avatar-img");
    expect(body).toMatch(/border-radius:\s*0/);
  });
});
