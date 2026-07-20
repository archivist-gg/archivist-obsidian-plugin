/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderAddDrawer } from "../packages/obsidian/src/modules/pc/components/spells/add-drawer";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

vi.mock("../packages/obsidian/src/modules/spell/spell.renderer", () => ({
  renderSpellBlock: vi.fn(() => Promise.resolve(document.createElement("div"))),
}));

beforeAll(() => installObsidianDomHelpers());

// N wizard cantrips, numbered so the default level→name sort is stable and a
// "Spell" substring search keeps the whole set (each name contains "Spell").
function wizardSpells(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const num = String(i + 1).padStart(3, "0");
    return {
      slug: `spell-${num}`,
      name: `Spell ${num}`,
      entityType: "spell",
      data: { name: `Spell ${num}`, level: 0, classes: ["wizard"], edition: "2014" },
    };
  });
}

function ctx(
  reg: ReturnType<typeof buildMockRegistry>,
  bag?: Map<string, unknown>,
): ComponentRenderContext {
  return {
    resolved: { spells: [] } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 1: 4 }, pactMagic: null } as never,
    services: { entities: reg } as never,
    app: {} as never,
    editState: { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() } as never,
    builderUiState: bag,
  };
}

const rowCount = (root: HTMLElement) =>
  root.querySelectorAll(".pc-spell-add-table .pc-spell-add-row").length;
const loadMore = (root: HTMLElement) =>
  root.querySelector(".pc-inv-loadmore-btn") as HTMLButtonElement | null;
const nameHeader = (root: HTMLElement) =>
  [...root.querySelectorAll(".pc-spell-add-table .pc-add-th")].find(
    (h) => h.textContent?.trim().startsWith("Name"),
  ) as HTMLElement;

describe("renderAddDrawer — pagination", () => {
  it("caps the initial list at 50 rows with a Load more (N) button", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(60))));
    expect(rowCount(root)).toBe(50);
    expect(loadMore(root)?.textContent).toBe("Load more (10)");
  });

  it("clicking Load more reveals the next 50 and drops the button when exhausted", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(60))));
    loadMore(root)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowCount(root)).toBe(60);
    expect(loadMore(root)).toBeNull();
  });

  it("no Load more button when the candidate count is at or below 50", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(50))));
    expect(rowCount(root)).toBe(50);
    expect(loadMore(root)).toBeNull();
  });

  it("the Load more control lives outside the horizontally-scrolling table host", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(60))));
    // Never a descendant of .pc-add-tablehost (so it can't ride the table's
    // horizontal scroll), but present at the drawer level.
    expect(root.querySelector(".pc-add-tablehost .pc-inv-loadmore")).toBeNull();
    expect(root.querySelector(".pc-inv-loadmore")).not.toBeNull();
  });

  it("the button never accumulates across repeated re-draws", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(60)), new Map()));
    // Two sort-header clicks re-draw the table twice; exactly one button remains.
    nameHeader(root).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    nameHeader(root).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelectorAll(".pc-inv-loadmore").length).toBe(1);
  });

  it("the shown-count persists across whole-drawer re-renders at the same filter", () => {
    const bag = new Map<string, unknown>();
    const reg = buildMockRegistry(wizardSpells(60));

    const root1 = mountContainer();
    renderAddDrawer(root1, ctx(reg, bag));
    loadMore(root1)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowCount(root1)).toBe(60);

    // Fresh drawer, same persistent bag → the bumped count survives.
    const root2 = mountContainer();
    renderAddDrawer(root2, ctx(reg, bag));
    expect(rowCount(root2)).toBe(60);
    expect(loadMore(root2)).toBeNull();
  });

  it("a sort change resets the shown-count to 50", () => {
    const bag = new Map<string, unknown>();
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(60)), bag));
    loadMore(root)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowCount(root)).toBe(60);
    // Sorting alters the persistence signature → back to the first page.
    nameHeader(root).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowCount(root)).toBe(50);
    expect(loadMore(root)?.textContent).toBe("Load more (10)");
  });

  it("a search change resets the shown-count to 50", () => {
    const bag = new Map<string, unknown>();
    const root = mountContainer();
    renderAddDrawer(root, ctx(buildMockRegistry(wizardSpells(60)), bag));
    loadMore(root)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowCount(root)).toBe(60);
    // "Spell" matches all 60 names, so the set is unchanged — only the signature
    // changes, which must reset the count.
    const search = root.querySelector(".pc-spell-search") as HTMLInputElement;
    search.value = "Spell";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rowCount(root)).toBe(50);
    expect(loadMore(root)?.textContent).toBe("Load more (10)");
  });
});
