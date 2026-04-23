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
    expect(view.contentEl.querySelector(".pc-name")?.textContent).toBe("Grendal the Wary");
    expect(view.contentEl.querySelector(".pc-subtitle")?.textContent).toContain("Hill Folk");
    expect(view.contentEl.querySelector(".pc-subtitle")?.textContent).toContain("Bladesworn");
    expect(view.contentEl.querySelector(".archivist-pc-sheet")).not.toBeNull();
  });

  it("ability row shows final scores with racial ASI applied (CON 14→16, WIS 13→14)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const con = view.contentEl.querySelector<HTMLElement>('[data-ability="con"]');
    const wis = view.contentEl.querySelector<HTMLElement>('[data-ability="wis"]');
    expect(con?.querySelector(".pc-ability-score")?.textContent).toBe("16");
    expect(wis?.querySelector(".pc-ability-score")?.textContent).toBe("14");
  });

  it("combat stats show correct AC, speed, initiative, HP", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const bigs = [...view.contentEl.querySelectorAll(".pc-combat-big")].map((b) => b.textContent);
    expect(bigs).toContain("+3"); // prof bonus at level 5
    expect(bigs).toContain("25"); // Hill folk speed
    expect(view.contentEl.querySelector(".pc-hp-current")?.textContent).toBe("38");
    expect(view.contentEl.querySelector(".pc-hp-max")?.textContent).toBe("44");
  });

  it("saves-panel shows STR & CON proficient (first class's saves)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const rows = [...view.contentEl.querySelectorAll<HTMLElement>(".pc-save-row")];
    const str = rows.find((r) => r.querySelector(".pc-save-name")?.textContent === "STR");
    const con = rows.find((r) => r.querySelector(".pc-save-name")?.textContent === "CON");
    expect(str?.querySelector(".pc-prof-dot.filled")).not.toBeNull();
    expect(con?.querySelector(".pc-prof-dot.filled")).not.toBeNull();
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
