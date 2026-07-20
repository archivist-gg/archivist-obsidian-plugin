/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { BrowseMode } from "../packages/obsidian/src/modules/pc/components/inventory/browse-mode";
import type { FilterState } from "../packages/obsidian/src/modules/pc/components/inventory/filter-state";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

function emptyFilters(): FilterState {
  return { status: "all", types: new Set(), rarities: new Set(), search: "" };
}

/** Stub EntityRegistry whose `search("", type, limit)` returns `count` "item"
 *  rows (weapon/armor sweep returns nothing), mirroring collectCompendiumItems'
 *  enumeration shim so BrowseMode sees `count` compendium items. */
function makeCtx(count: number, bag?: Map<string, unknown>): ComponentRenderContext {
  const items = Array.from({ length: count }, (_, i) => ({
    slug: `item-${i}`,
    name: `Item ${i}`,
    entityType: "item",
    data: { name: `Item ${i}`, type: "gear", weight: 1 },
  }));
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: {} as never,
    services: {
      entities: {
        search: (_q: string, type: string | undefined) => (type === "item" ? items : []),
      },
    } as never,
    app: {} as never,
    editState: null,
    builderUiState: bag,
  };
}

describe("BrowseMode pagination", () => {
  it("caps the catalog at 50 rows and shows a Load more (N) button", () => {
    const root = mountContainer();
    new BrowseMode({ filters: emptyFilters() }).render(root, makeCtx(60, new Map()));

    expect(root.querySelectorAll(".pc-inv-row-host").length).toBe(50);
    const btn = root.querySelector(".pc-inv-loadmore-btn") as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toBe("Load more (10)");
  });

  it("reveals the next page on click and drops the button once exhausted", () => {
    const root = mountContainer();
    new BrowseMode({ filters: emptyFilters() }).render(root, makeCtx(60, new Map()));

    (root.querySelector(".pc-inv-loadmore-btn") as HTMLButtonElement).click();

    expect(root.querySelectorAll(".pc-inv-row-host").length).toBe(60);
    expect(root.querySelector(".pc-inv-loadmore-btn")).toBeNull();
  });

  it("keeps the shown-count across a re-render for the same browse filters", () => {
    const bag = new Map<string, unknown>();
    const filters = emptyFilters();

    const first = mountContainer();
    new BrowseMode({ filters }).render(first, makeCtx(60, bag));
    (first.querySelector(".pc-inv-loadmore-btn") as HTMLButtonElement).click();
    expect(first.querySelectorAll(".pc-inv-row-host").length).toBe(60);

    // Same filters + same bag (a fresh sheet re-render) → still 60, not reset.
    const second = mountContainer();
    new BrowseMode({ filters: emptyFilters() }).render(second, makeCtx(60, bag));
    expect(second.querySelectorAll(".pc-inv-row-host").length).toBe(60);
  });

  it("resets to 50 when the browse filters or search change", () => {
    const bag = new Map<string, unknown>();

    const first = mountContainer();
    new BrowseMode({ filters: emptyFilters() }).render(first, makeCtx(60, bag));
    (first.querySelector(".pc-inv-loadmore-btn") as HTMLButtonElement).click();
    expect(first.querySelectorAll(".pc-inv-row-host").length).toBe(60);

    // A different search string (still matching all "Item N" names, so >50
    // remain visible) → new signature → back to the first page.
    const changed = { ...emptyFilters(), search: "item" };
    const second = mountContainer();
    new BrowseMode({ filters: changed }).render(second, makeCtx(60, bag));
    expect(second.querySelectorAll(".pc-inv-row-host").length).toBe(50);
  });
});
