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
} from "./fixtures/pc/grendal-the-wary";
import {
  PLATE,
  SHIELD,
  LONGSWORD,
  CLOAK_OF_PROTECTION,
} from "./fixtures/pc/equipment-fixtures";
import { extractPCCodeBlock, parsePC } from "../src/modules/pc/pc.parser";
import { PCResolver } from "../src/modules/pc/pc.resolver";
import { recalc } from "../src/modules/pc/pc.recalc";
import { WorkspaceLeaf } from "obsidian";
import type { CoreAPI } from "../src/core/module-api";
import type { EntityRegistry } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

function buildGrendalRegistry(): EntityRegistry {
  // Grendal's longsword is registered as a proper WeaponEntity (SP5 shape) so
  // the equipment derive can build attack rows and apply weapon properties.
  // Plate/shield/cloak come from the SP5 equipment fixtures.
  return buildMockRegistry([
    { slug: "hill-folk", entityType: "race", data: HILL_FOLK },
    { slug: "bladesworn", entityType: "class", data: BLADESWORN },
    { slug: "path-of-shadow", entityType: "subclass", data: PATH_OF_SHADOW },
    { slug: "drifter", entityType: "background", data: DRIFTER },
    { slug: "sure-step", entityType: "feat", data: SURE_STEP },
    { slug: "plate", entityType: "armor", name: "Plate", data: PLATE },
    { slug: "shield", entityType: "armor", name: "Shield", data: SHIELD },
    { slug: "longsword", entityType: "weapon", name: "Longsword", data: LONGSWORD },
    {
      slug: "cloak-of-protection",
      entityType: "item",
      name: "Cloak of Protection",
      data: CLOAK_OF_PROTECTION,
    },
  ]);
}

function boot(): { view: PCSheetView; mod: PCModule } {
  const mod = new PCModule();
  const entities = buildGrendalRegistry();
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
    ).toContain("38");
    // toContain rather than toBe — SP4b appends an override `*` mark inside
    // the value element when overrides.hp.max is set on the fixture.
    expect(
      root.querySelector(".pc-hp-widget .pc-hp-max .pc-hp-val")?.textContent,
    ).toContain("44");
    // Right cluster containers exist.
    expect(root.querySelector(".pc-stats-right .pc-stats-tiles")).not.toBeNull();
    expect(root.querySelector(".pc-stats-right .pc-def-cond")).not.toBeNull();
    // Defenses panel reflects the fixture's defenses block.
    const left = root.querySelector(".pc-def-cond-left");
    expect(left?.textContent).toContain("Damage Resistances");
    expect(left?.textContent).toContain("fire");
    expect(left?.textContent).toContain("Condition Immunities");
    // Condition immunities display as PascalCase name (SP4b)
    expect(left?.textContent).toContain("Charmed");
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

describe("PC end-to-end — overrides round-trip (SP4b)", () => {
  it("AC override applies to derived.ac, shows mark in the shield, and persists in YAML", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const root = view.contentEl;

    // Click the AC number to open the inline input
    const numEl = root.querySelector<HTMLElement>(".pc-ac-shield-num")!;
    const acBefore = parseInt(numEl.textContent ?? "0", 10);
    numEl.click();
    const input = root.querySelector<HTMLInputElement>(".pc-ac-shield input.pc-edit-inline")!;
    input.value = String(acBefore + 5);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await Promise.resolve();

    // Post-render, the AC number reflects the override and the mark is visible
    const numElAfter = view.contentEl.querySelector<HTMLElement>(".pc-ac-shield-num")!;
    expect(parseInt(numElAfter.textContent ?? "0", 10)).toBe(acBefore + 5);
    expect(view.contentEl.querySelector(".pc-ac-shield .archivist-override-mark")).not.toBeNull();

    // Serialized YAML has the override
    const yaml = view.getViewData();
    expect(yaml).toMatch(new RegExp(`ac:\\s*${acBefore + 5}`));

    // Clear the override
    view.contentEl.querySelector<HTMLElement>(".pc-ac-shield .archivist-override-mark")!.click();
    await Promise.resolve();
    const numElCleared = view.contentEl.querySelector<HTMLElement>(".pc-ac-shield-num")!;
    expect(parseInt(numElCleared.textContent ?? "0", 10)).toBe(acBefore);
    expect(view.contentEl.querySelector(".pc-ac-shield .archivist-override-mark")).toBeNull();
    expect(view.getViewData()).not.toMatch(/overrides:\s*\n\s+ac:/);
  });
});

describe("PC end-to-end — overrides round-trip (SP4c)", () => {
  // Helpers: click + type + Enter, then await microtask. Always re-query
  // the DOM after — re-render replaces the elements.
  async function commit(view: PCSheetView, valueSelector: string, next: number): Promise<void> {
    view.contentEl.querySelector<HTMLElement>(valueSelector)!.click();
    const input = view.contentEl.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = String(next);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await Promise.resolve();
  }

  async function clearViaMark(view: PCSheetView, markSelector: string): Promise<void> {
    view.contentEl.querySelector<HTMLElement>(markSelector)!.click();
    await Promise.resolve();
  }

  it("speed override applies, persists in YAML, and clears", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const baseline = view.contentEl.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-num")?.textContent ?? "";

    await commit(view, ".pc-stats-tile[data-stat='speed'] .pc-stats-tile-num", 40);

    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-num")?.textContent).toContain("40");
    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='speed'] .archivist-override-mark")).not.toBeNull();
    expect(view.getViewData()).toMatch(/speed:\s*40/);

    await clearViaMark(view, ".pc-stats-tile[data-stat='speed'] .archivist-override-mark");
    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-num")?.textContent).toBe(baseline);
    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='speed'] .archivist-override-mark")).toBeNull();
    expect(view.getViewData()).not.toMatch(/overrides:[\s\S]*?\n\s+speed:/);
  });

  it("initiative override applies, persists in YAML, and clears", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const baseline = view.contentEl.querySelector(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")?.textContent ?? "";

    await commit(view, ".pc-stats-tile[data-stat='init'] .pc-stats-tile-val", 7);

    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")?.textContent).toContain("+7");
    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='init'] .archivist-override-mark")).not.toBeNull();
    expect(view.getViewData()).toMatch(/initiative:\s*7/);

    await clearViaMark(view, ".pc-stats-tile[data-stat='init'] .archivist-override-mark");
    expect(view.contentEl.querySelector(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")?.textContent).toBe(baseline);
  });

  it("passive perception override applies, persists, and clears", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    // PASSIVE_ROWS in senses-panel.ts renders Perception first.
    const baseline = view.contentEl.querySelectorAll(".pc-sense-row")[0]?.querySelector(".pc-sense-val")?.textContent ?? "";

    await commit(view, ".pc-sense-row:nth-child(1) .pc-sense-val", 22);

    const row = view.contentEl.querySelectorAll(".pc-sense-row")[0];
    expect(row.querySelector(".pc-sense-val")?.textContent).toContain("22");
    expect(row.querySelector(".archivist-override-mark")).not.toBeNull();
    expect(view.getViewData()).toMatch(/passives:[\s\S]*?perception:\s*22/);

    await clearViaMark(view, ".pc-sense-row:nth-child(1) .archivist-override-mark");
    const cleared = view.contentEl.querySelectorAll(".pc-sense-row")[0];
    expect(cleared.querySelector(".pc-sense-val")?.textContent).toBe(baseline);
    expect(cleared.querySelector(".archivist-override-mark")).toBeNull();
  });

  it("skill bonus override applies, persists, and clears (Athletics)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    const baseline = view.contentEl.querySelector("[data-skill='athletics'] .pc-skill-bonus")?.textContent ?? "";

    await commit(view, "[data-skill='athletics'] .pc-skill-bonus", 12);

    const row = view.contentEl.querySelector<HTMLElement>("[data-skill='athletics']")!;
    expect(row.querySelector(".pc-skill-bonus")?.textContent).toContain("+12");
    expect(row.querySelector(".archivist-override-mark")).not.toBeNull();
    expect(view.getViewData()).toMatch(/skills:[\s\S]*?athletics:[\s\S]*?bonus:\s*12/);

    await clearViaMark(view, "[data-skill='athletics'] .archivist-override-mark");
    const cleared = view.contentEl.querySelector<HTMLElement>("[data-skill='athletics']")!;
    expect(cleared.querySelector(".pc-skill-bonus")?.textContent).toBe(baseline);
    // Parent dropped — no `overrides.skills:` block remains for this slug.
    expect(view.getViewData()).not.toMatch(/skills:[\s\S]*?athletics:[\s\S]*?bonus:/);
  });

  it("save bonus override applies, persists, and clears (STR)", async () => {
    const { view } = boot();
    await view.setViewData(GRENDAL_MD, true);
    // .pc-save-chip is a sibling of .pc-ab inside .pc-ab-stack — use :has() to scope.
    const stackSel = ".pc-ab-stack:has(.pc-ab[data-ability='str'])";
    const baseline = view.contentEl.querySelector(`${stackSel} .pc-save-bn`)?.textContent ?? "";

    await commit(view, `${stackSel} .pc-save-bn`, 9);

    const chip = view.contentEl.querySelector<HTMLElement>(`${stackSel} .pc-save-chip`)!;
    expect(chip.querySelector(".pc-save-bn")?.textContent).toContain("+9");
    expect(chip.querySelector(".pc-save-bn .archivist-override-mark")).not.toBeNull();
    expect(view.getViewData()).toMatch(/saves:[\s\S]*?str:[\s\S]*?bonus:\s*9/);

    await clearViaMark(view, `${stackSel} .pc-save-bn .archivist-override-mark`);
    const cleared = view.contentEl.querySelector<HTMLElement>(`${stackSel} .pc-save-chip`)!;
    expect(cleared.querySelector(".pc-save-bn")?.textContent).toBe(baseline);
  });
});

describe("Grendal — SP5 equipment integration", () => {
  // Drive parser → resolver → recalc with the same Grendal markdown the DOM
  // tests use, then assert against the derived object directly. Hits the same
  // pipeline as the view but exposes the structured AC breakdown and attack
  // rows that aren't easy to read off the rendered DOM.
  function deriveGrendal(): {
    derived: ReturnType<typeof recalc>;
    registry: EntityRegistry;
  } {
    const registry = buildGrendalRegistry();
    const extracted = extractPCCodeBlock(GRENDAL_MD);
    if (!extracted) throw new Error("expected pc code block in Grendal fixture");
    const parsed = parsePC(extracted.yaml);
    if (!parsed.success) throw new Error(`parse failed: ${parsed.error}`);
    const resolved = new PCResolver(registry).resolve(parsed.data).character;
    const derived = recalc(resolved, registry);
    return { derived, registry };
  }

  it("AC reflects plate + shield + cloak of protection (heavy armor ignores DEX)", () => {
    const { derived } = deriveGrendal();
    // Plate (heavy, AC 18, no DEX) + Shield (+2) + Cloak of Protection (+1, attuned) = 21.
    // Grendal's DEX is 14 (mod +2), but heavy armor zeroes DEX contribution.
    expect(derived.ac).toBe(21);
    const sources = derived.acBreakdown.map((t) => t.source);
    expect(sources).toEqual(
      expect.arrayContaining(["Plate", "Shield", "Cloak of Protection"]),
    );
  });

  it("renders an attack row for the equipped longsword", () => {
    const { derived } = deriveGrendal();
    expect(derived.attacks.length).toBeGreaterThan(0);
    // Longsword is versatile — first row is 1h (1d8), second is 2h (1d10).
    const main = derived.attacks[0];
    expect(main.name).toMatch(/longsword/i);
    // STR 16 (mod +3), proficient (martial) at level 5 (PB +3) → +6 to hit.
    expect(main.toHit).toBe(6);
    expect(main.damageDice).toBe("1d8+3");
    expect(main.damageType).toBe("slashing");
    expect(main.proficient).toBe(true);
  });

  it("acBreakdown enumerates each contributing term in order", () => {
    const { derived } = deriveGrendal();
    // Heavy armor (plate) suppresses the dex term entirely; the breakdown
    // should contain exactly Plate (base) + Shield + Cloak of Protection.
    const sources = derived.acBreakdown.map((t) => t.source);
    expect(sources).toContain("Plate");
    expect(sources).toContain("Shield");
    expect(sources).toContain("Cloak of Protection");
    // Sum of the breakdown amounts must reconcile with derived.ac.
    const total = derived.acBreakdown.reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(derived.ac);
  });
});
