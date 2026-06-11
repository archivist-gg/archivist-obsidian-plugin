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

  it("single mode renders seal toggles: ✓ always present, on-class only when selected", () => {
    const root = mountContainer();
    const onToggle = vi.fn();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t", selected: new Set(["a-feat"]), onToggle, single: true,
    });
    const toggles = root.querySelectorAll<HTMLElement>(".pc-btoggle");
    toggles.forEach((t) => {
      expect(t.classList.contains("seal")).toBe(true);
      expect(t.textContent).toBe("✓"); // CSS hides it off rest rows (transparent)
    });
    expect(toggles[0].classList.contains("on")).toBe(true); // Alert selected
    expect(toggles[0].getAttribute("title")).toBe("Current");
    expect(toggles[1].classList.contains("on")).toBe(false);
    expect(toggles[1].getAttribute("title")).toBe("Select");
    toggles[1].click();
    expect(onToggle).toHaveBeenCalledWith("b-feat");
  });

  it("sizes the name column as the fluid track so the ledger fills wide hosts", () => {
    const root = mountContainer();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [CAT_COL], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    const head = root.querySelector<HTMLElement>(".pc-btable-head")!;
    expect(head.style.gridTemplateColumns).toBe("30px minmax(200px, 1fr) 90px 110px");
    const row = root.querySelector<HTMLElement>(".pc-btable-row")!;
    expect(row.style.gridTemplateColumns).toBe(head.style.gridTemplateColumns);
  });

  it("multi mode (default) keeps the ＋ glyph on unselected rows", () => {
    const root = mountContainer();
    renderSelectionTable(root, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t", selected: new Set(), onToggle: () => {},
    });
    const toggle = root.querySelector<HTMLElement>(".pc-btoggle")!;
    expect(toggle.textContent).toBe("＋");
    expect(toggle.classList.contains("seal")).toBe(false);
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

describe("renderSelectionTable — expandSelect mode", () => {
  // CANDS render name-sorted, so the first DOM row is "Alert" (a-feat). Tests
  // that pre-select "the selected row" use that slug to keep DOM order honest.
  const FIRST_SLUG = "a-feat";

  it("renders no toggle column and no col-add header", () => {
    const container = mountContainer();
    renderSelectionTable(container, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t.es1",
      selected: new Set(), onToggle: vi.fn(), expandSelect: true,
    });
    expect(container.querySelectorAll(".pc-btoggle").length).toBe(0);
    expect(container.querySelectorAll(".col-add").length).toBe(0);
  });

  it("row click expands the row AND fires onToggle for an unselected row", () => {
    const container = mountContainer();
    const onToggle = vi.fn();
    renderSelectionTable(container, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t.es2",
      selected: new Set(), onToggle, expandSelect: true,
    });
    (container.querySelector(".pc-btable-row") as HTMLElement).click();
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("expanding a second row collapses the first (solo-expand)", () => {
    const container = mountContainer();
    renderSelectionTable(container, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t.es3",
      selected: new Set(), onToggle: vi.fn(), expandSelect: true,
    });
    const rows = container.querySelectorAll(".pc-btable-row");
    (rows[0] as HTMLElement).click();
    (rows[1] as HTMLElement).click();
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    expect(rows[1].classList.contains("pc-row-open")).toBe(true);
    expect(rows[0].classList.contains("pc-row-open")).toBe(false);
  });

  it("re-clicking the selected row collapses without firing onToggle", () => {
    const container = mountContainer();
    const onToggle = vi.fn();
    renderSelectionTable(container, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t.es4",
      selected: new Set([FIRST_SLUG]), onToggle, expandSelect: true,
    });
    const row = container.querySelector(".pc-btable-row") as HTMLElement;
    row.click(); // expand (already selected → no toggle)
    row.click(); // collapse
    expect(onToggle).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(0);
  });

  it("selected row shows the inline name seal; restore-open never fires onToggle", () => {
    const container = mountContainer();
    const onToggle = vi.fn();
    const bag = new Map<string, unknown>();
    bag.set("t.es5", { sortKey: "name", sortDir: "asc", expanded: new Set([FIRST_SLUG]) });
    renderSelectionTable(container, ctxWith(bag), {
      columns: [], candidates: CANDS, stateKey: "t.es5",
      selected: new Set([FIRST_SLUG]), onToggle, expandSelect: true,
    });
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1); // restored
    expect(onToggle).not.toHaveBeenCalled();
    expect(container.querySelector(".pc-bname-seal")?.textContent).toContain("✓");
  });

  it("renderExpand override replaces the default entity block", () => {
    const container = mountContainer();
    renderSelectionTable(container, ctxWith(new Map()), {
      columns: [], candidates: CANDS, stateKey: "t.es6",
      selected: new Set(), onToggle: vi.fn(), expandSelect: true,
      renderExpand: (wrap) => wrap.createDiv({ cls: "custom-expand", text: "hi" }),
    });
    (container.querySelector(".pc-btable-row") as HTMLElement).click();
    expect(container.querySelector(".custom-expand")).toBeTruthy();
  });
});
