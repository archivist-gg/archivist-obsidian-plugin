/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderSelectionTable, type ColSpec } from "../src/modules/pc/components/builder/selection-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const ent = (slug: string, name: string, category: string): RegisteredEntity => ({
  slug, name, entityType: "feat", filePath: `${slug}.md`,
  data: { name, category, edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false,
});

const CANDS = [ent("b-feat", "Brawny", "general"), ent("a-feat", "Alert", "origin")];

const CAT_COL: ColSpec = {
  label: "Category", cls: "col-cat", width: "90px",
  sort: (a, b) => String(a.data.category).localeCompare(String(b.data.category)),
  render: (cell, e) => { cell.setText(String(e.data.category)); },
};

function ctxWith(bag: Map<string, unknown>): ComponentRenderContext {
  const blockModule = {
    parseYaml: () => ({ success: true, data: {} }),
    render: (el: HTMLElement) => el.createDiv({ cls: "fake-block" }),
  };
  return {
    core: { plugin: {}, modules: { getByEntityType: () => blockModule } },
    builderUiState: bag,
  } as unknown as ComponentRenderContext;
}

describe("renderSelectionTable", () => {
  it("renders header + one grid row per candidate, name-sorted ascending by default", () => {
    const root = mountContainer();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [CAT_COL], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    const names = [...root.querySelectorAll(".pc-btable-row .col-name")].map((n) => n.textContent);
    expect(names).toEqual(["Alert", "Brawny"]);
    expect(root.querySelectorAll(".pc-btable-head .pc-btable-th").length).toBe(4); // add, name, category, source
  });

  it("clicking a sortable header sorts by that column and flips direction on re-click", () => {
    const root = mountContainer();
    const bag = new Map<string, unknown>();
    renderSelectionTable(root, ctxWith(bag), {
      columns: [CAT_COL], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    const catTh = root.querySelectorAll<HTMLElement>(".pc-btable-th")[2];
    catTh.click(); // general(Brawny) vs origin(Alert) → asc: Brawny, Alert
    let names = [...root.querySelectorAll(".pc-btable-row .col-name")].map((n) => n.textContent);
    expect(names).toEqual(["Brawny", "Alert"]);
    root.querySelectorAll<HTMLElement>(".pc-btable-th")[2].click(); // desc
    names = [...root.querySelectorAll(".pc-btable-row .col-name")].map((n) => n.textContent);
    expect(names).toEqual(["Alert", "Brawny"]);
  });

  it("＋ fires onToggle and a selected row shows ✓", () => {
    const root = mountContainer();
    const onToggle = vi.fn();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t", selected: new Set(["a-feat"]), onToggle,
    });
    const toggles = root.querySelectorAll<HTMLElement>(".pc-btoggle");
    expect(toggles[0].textContent).toBe("✓"); // Alert selected
    toggles[1].click();
    expect(onToggle).toHaveBeenCalledWith("b-feat");
  });

  it("row click expands the entity block inline; expand state survives a rebuild", () => {
    const root = mountContainer();
    const bag = new Map<string, unknown>();
    const opts = { columns: [], candidates: CANDS, stateKey: "t", selected: new Set<string>(), onToggle: () => {} };
    renderSelectionTable(root, ctxWith(bag), opts);
    root.querySelector<HTMLElement>(".pc-btable-row")!.click();
    expect(root.querySelector(".pc-btable-expand .fake-block")).not.toBeNull();
    // simulate a full re-render with the same bag
    const root2 = mountContainer();
    renderSelectionTable(root2, ctxWith(bag), opts);
    expect(root2.querySelector(".pc-btable-expand .fake-block")).not.toBeNull();
  });

  it("source column shows the compendium name", () => {
    const root = mountContainer();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    expect(root.querySelector(".pc-btable-row .col-source .pc-bsrc")?.textContent).toBe("SRD 5e");
  });

  it("clicking the same row twice collapses the inline entity block", () => {
    const root = mountContainer();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    const row = root.querySelector<HTMLElement>(".pc-btable-row")!;
    row.click();
    expect(root.querySelector(".pc-btable-expand-row")).not.toBeNull();
    expect(row.classList.contains("pc-row-open")).toBe(true);
    row.click();
    expect(root.querySelector(".pc-btable-expand-row")).toBeNull();
    expect(root.querySelector(".pc-btable-row")!.classList.contains("pc-row-open")).toBe(false);
  });

  it("renders an empty-state message and no table when there are no candidates", () => {
    const root = mountContainer();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [], candidates: [], stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    expect(root.querySelector(".pc-btable-empty")?.textContent).toBe("No matches.");
    expect(root.querySelector(".pc-btable")).toBeNull();
  });

  it("a stale persisted sort index falls back to name-ascending without throwing", () => {
    const root = mountContainer();
    const bag = new Map<string, unknown>();
    bag.set("t", { sortKey: 5, sortDir: "asc", expanded: new Set<string>() });
    expect(() =>
      renderSelectionTable(root, ctxWith(bag), {
        columns: [], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
      }),
    ).not.toThrow();
    const names = [...root.querySelectorAll(".pc-btable-row .col-name")].map((n) => n.textContent);
    expect(names).toEqual(["Alert", "Brawny"]);
  });
});
