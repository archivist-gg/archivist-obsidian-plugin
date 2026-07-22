/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PCSheetView } from "../packages/obsidian/src/modules/pc/pc.view";
import { PCModule } from "../packages/obsidian/src/modules/pc/pc.module";
import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { PCServices } from "../packages/obsidian/src/modules/pc/pc.services";
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

function renderWith(portraitUrl: string | null, onOpen?: () => void) {
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
      onOpenPortraitPicker: onOpen,
    });
    return root;
  });
}

describe("header portrait rendering", () => {
  it("renders the d20 default icon in a button avatar when no portrait is set", async () => {
    const root = await renderWith(null);
    const btn = root.querySelector("button.pc-avatar");
    expect(btn).toBeTruthy();
    expect(btn!.getAttribute("aria-label")).toBe("Set character portrait");
    expect(btn!.querySelector("svg.pc-avatar-icon, .pc-avatar-icon svg, svg")).toBeTruthy();
    expect(btn!.querySelector("img")).toBeNull();
    expect(root.querySelector(".pc-avatar-placeholder")).toBeNull();
  });
  it("renders a cover img when portraitUrl is set", async () => {
    const root = await renderWith("app://local/x.png");
    const img = root.querySelector("button.pc-avatar img.pc-avatar-img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("app://local/x.png");
    expect(img.getAttribute("alt")).toBe("");
    expect(root.querySelector("button.pc-avatar svg")).toBeNull();
  });
  it("threads onOpenPortraitPicker through renderPCSheet ctx into the click handler", async () => {
    const onOpen = vi.fn();
    const root = await renderWith(null, onOpen);
    (root.querySelector("button.pc-avatar") as HTMLButtonElement).click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
