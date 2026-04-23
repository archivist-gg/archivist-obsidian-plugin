/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PCSheetView } from "../src/modules/pc/pc.view";
import { PCModule } from "../src/modules/pc/pc.module";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import {
  GRENDAL_MD,
  HILL_FOLK,
  BLADESWORN,
  PATH_OF_SHADOW,
  DRIFTER,
  SURE_STEP,
  LONGSWORD,
} from "./fixtures/pc/grendal-the-wary";
import { WorkspaceLeaf } from "obsidian";
import type { CoreAPI } from "../src/core/module-api";

beforeAll(() => installObsidianDomHelpers());

function boot(): { view: PCSheetView; mod: PCModule } {
  const mod = new PCModule();
  const entities = buildMockRegistry([
    { slug: "hill-folk", entityType: "race", data: HILL_FOLK },
    { slug: "bladesworn", entityType: "class", data: BLADESWORN },
    { slug: "path-of-shadow", entityType: "subclass", data: PATH_OF_SHADOW },
    { slug: "drifter", entityType: "background", data: DRIFTER },
    { slug: "sure-step", entityType: "feat", data: SURE_STEP },
    { slug: "longsword", entityType: "item", data: LONGSWORD },
  ]);
  mod.register({ entities } as unknown as CoreAPI);
  return { view: new PCSheetView(new WorkspaceLeaf(), mod), mod };
}

describe("PC end-to-end: Grendal the Wary", () => {
  it("renders header with name, subtitle, and parchment wrapper", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const root = view.contentEl;
    expect(root.querySelector(".pc-name")?.textContent).toBe("Grendal the Wary");
    expect(root.querySelector(".pc-subtitle")?.textContent).toContain("Hill Folk");
    expect(root.querySelector(".pc-subtitle")?.textContent).toContain("Bladesworn");
    expect(root.querySelector(".pc-subtitle")?.textContent).not.toContain("Lawful Good");
    expect(root.querySelector(".archivist-pc-sheet")).not.toBeNull();
    // V7 hero-right cluster: AC shield + HP widget + HD widget
    expect(root.querySelector(".pc-hero-right .pc-ac-shield")).not.toBeNull();
    expect(root.querySelector(".pc-hero-right .pc-hp-widget")).not.toBeNull();
    expect(root.querySelector(".pc-hero-right .pc-hd-widget")).not.toBeNull();
  });

  it("ability row shows final scores with racial ASI applied (CON 14→16, WIS 13→14)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const root = view.contentEl;
    // V7: ability row is 6 free-floating stacks with inline save chips.
    expect(root.querySelectorAll(".pc-ab-stack").length).toBe(6);
    expect(root.querySelectorAll(".pc-ab-stack .pc-save-chip").length).toBe(6);
    expect(root.querySelector(".pc-ab[data-ability='con'] .pc-ab-score")?.textContent).toBe("16");
    expect(root.querySelector(".pc-ab[data-ability='wis'] .pc-ab-score")?.textContent).toBe("14");
  });

  it("combat stats show correct AC, speed, initiative, HP", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const root = view.contentEl;
    // V7: AC lives in the hero-right shield, HP widget shows current/max,
    // speed + init live in the right-cluster stats tiles.
    expect(root.querySelector(".pc-ac-shield-num")?.textContent).toBeTruthy();
    expect(
      root.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-val")?.textContent,
    ).toContain("25");
    expect(
      root.querySelector(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")?.textContent,
    ).toBe("+2");
    expect(
      root.querySelector(".pc-hp-widget .pc-hp-current .pc-hp-val")?.textContent,
    ).toBe("38");
    expect(
      root.querySelector(".pc-hp-widget .pc-hp-max .pc-hp-val")?.textContent,
    ).toBe("44");
    // Right cluster containers exist.
    expect(root.querySelector(".pc-stats-right .pc-stats-tiles")).not.toBeNull();
    expect(root.querySelector(".pc-stats-right .pc-def-cond")).not.toBeNull();
    // Defenses panel reflects the fixture's defenses block.
    const left = root.querySelector(".pc-def-cond-left");
    expect(left?.textContent).toContain("Damage Resistances");
    expect(left?.textContent).toContain("fire");
    expect(left?.textContent).toContain("Condition Immunities");
    expect(left?.textContent).toContain("charmed");
  });

  it("saves: STR & CON proficient (inline save chips, no sidebar saves list)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const root = view.contentEl;
    // V7 moved saves out of the sidebar.
    expect(root.querySelector(".pc-sidebar .pc-saves-list")).toBeNull();
    // Proficient saves are marked by the `.prof` class on `.pc-save-chip`.
    // The chip is a sibling of `.pc-ab` inside the shared `.pc-ab-stack`.
    const stackFor = (ab: string) =>
      root
        .querySelector(`.pc-ab[data-ability='${ab}']`)
        ?.parentElement?.querySelector(".pc-save-chip");
    expect(stackFor("str")?.classList.contains("prof")).toBe(true);
    expect(stackFor("con")?.classList.contains("prof")).toBe(true);
    expect(stackFor("dex")?.classList.contains("prof")).toBe(false);
  });

  it("features tab shows class, subclass (level-filtered), race, feat blocks", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    // Switch to the Features tab; it's not active by default.
    const featBtn = view.contentEl.querySelector<HTMLButtonElement>(
      '.pc-tab-btn[data-tab="panel-features"]',
    )!;
    featBtn.click();
    const panel = view.contentEl.querySelector<HTMLElement>("#panel-features")!;
    expect(panel.querySelector(".pc-class-block")).not.toBeNull();
    expect(panel.querySelector(".pc-subclass-block")).not.toBeNull();
    expect(panel.querySelector(".pc-race-block")).not.toBeNull();
    expect(panel.querySelector(".pc-feat-block")).not.toBeNull();
    // Level-filter: Extra Attack (L5) present, Relentless (L9) NOT present.
    const classText = panel.querySelector(".pc-class-block")?.textContent ?? "";
    expect(classText).toContain("Extra Attack");
    expect(classText).not.toContain("Relentless");
  });

  it("background tab renders background block", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    view.contentEl
      .querySelector<HTMLButtonElement>('.pc-tab-btn[data-tab="panel-background"]')!
      .click();
    const panel = view.contentEl.querySelector<HTMLElement>("#panel-background")!;
    expect(panel.textContent).toContain("Drifter");
    expect(panel.textContent).toContain("Wanderer's Way");
  });

  it("no warnings for a valid character (all slugs resolve, race present)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    expect(view.contentEl.querySelector(".archivist-pc-warnings")).toBeNull();
  });
});
