/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderEntityPicker } from "../src/modules/pc/components/builder/entity-picker";
import type { ColSpec } from "../src/modules/pc/components/builder/selection-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const races: RegisteredEntity[] = [
  { slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "elf.md",
    data: { name: "Elf", edition: "2014", size: "medium" }, compendium: "SRD 5e", readonly: true, homebrew: false },
  { slug: "srd-2024_human", name: "Human", entityType: "race", filePath: "human.md",
    data: { name: "Human", edition: "2024", size: "medium" }, compendium: "SRD 2024", readonly: true, homebrew: false },
];

function fakeCtx(bag: Map<string, unknown>): ComponentRenderContext {
  return {
    core: {
      plugin: {},
      entities: {
        search: (q: string, type: string) =>
          races.filter((r) => r.entityType === type && r.name.toLowerCase().includes(q.toLowerCase())),
      },
      compendiums: { getAll: () => [
        { name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" },
        { name: "SRD 2024", description: "", readonly: true, homebrew: false, folderPath: "" },
      ] },
      modules: { getByEntityType: () => undefined }, // expand falls back to the name line
    },
    builderUiState: bag,
  } as unknown as ComponentRenderContext;
}

const baseOpts = (onSelect = vi.fn()) =>
  ({ entityType: "race", stateKey: "p", selectedSlug: null, onSelect });

const rowByName = (root: HTMLElement, name: string): HTMLElement =>
  [...root.querySelectorAll<HTMLElement>(".pc-btable-row")]
    .find((r) => r.querySelector(".pc-btable-name")?.textContent === name)!;

describe("renderEntityPicker (single-select ledger)", () => {
  it("renders the ledger table: one row per candidate with seal toggles and source tags", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    expect(root.querySelectorAll(".pc-btable-row").length).toBe(2);
    expect(root.querySelectorAll(".pc-btoggle.seal").length).toBe(2);
    expect(root.querySelector(".pc-btable-row .col-source .pc-bsrc")?.textContent).toBe("SRD 5e");
    expect(root.querySelector(".pc-bpicker-detail")).toBeNull(); // two-pane layout is gone
  });

  it("typing filters the rows without rebuilding the search input (focus-safe)", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "hum";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelectorAll(".pc-btable-row").length).toBe(1);
    expect(root.querySelector<HTMLInputElement>(".pc-bpicker-search")).toBe(input);
  });

  it("unticking a compendium hides its rows", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const chip = [...root.querySelectorAll<HTMLElement>(".pc-bfilter-chip")]
      .find((c) => c.textContent === "SRD 2024")!;
    chip.click();
    const names = [...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toEqual(["Elf"]);
  });

  it("row click unfolds the entity block inline; the seal selects", () => {
    const root = mountContainer();
    const onSelect = vi.fn();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts(onSelect));
    rowByName(root, "Elf").click();
    expect(root.querySelector(".pc-btable-expand .pc-bblock-fallback")?.textContent).toBe("Elf");
    expect(onSelect).not.toHaveBeenCalled(); // reading is not choosing
    rowByName(root, "Elf").querySelector<HTMLElement>(".pc-btoggle.seal")!.click();
    expect(onSelect).toHaveBeenCalledWith("srd-5e_elf");
  });

  it("the row matching selectedSlug carries the pressed seal and crimson name", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(), selectedSlug: "srd-2024_human" });
    const human = rowByName(root, "Human");
    expect(human.querySelector(".pc-btoggle.seal")?.classList.contains("on")).toBe(true);
    expect(human.querySelector(".pc-btable-name")?.classList.contains("on")).toBe(true);
    const elf = rowByName(root, "Elf");
    expect(elf.querySelector(".pc-btoggle.seal")?.classList.contains("on")).toBe(false);
  });

  it("clicking the seal of the already-selected row fires no onSelect", () => {
    const root = mountContainer();
    const onSelect = vi.fn();
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(onSelect), selectedSlug: "srd-5e_elf" });
    rowByName(root, "Elf").querySelector<HTMLElement>(".pc-btoggle.seal")!.click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("query, ticks, and expanded rows survive a full rebuild via the lifted bag", () => {
    const bag = new Map<string, unknown>();
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(bag), baseOpts());
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "elf";
    input.dispatchEvent(new Event("input"));
    rowByName(root, "Elf").click(); // unfold
    // simulate the editState-mutation full re-render
    const root2 = mountContainer();
    renderEntityPicker(root2, fakeCtx(bag), baseOpts());
    expect(root2.querySelector<HTMLInputElement>(".pc-bpicker-search")!.value).toBe("elf");
    expect(root2.querySelectorAll(".pc-btable-row").length).toBe(1);
    expect(root2.querySelector(".pc-btable-expand .pc-bblock-fallback")?.textContent).toBe("Elf");
  });

  it("renders caller-supplied columns between Name and Source", () => {
    const root = mountContainer();
    const SIZE_COL: ColSpec = {
      label: "Size", cls: "col-size", width: "90px",
      render: (cell, e) => { cell.setText(String((e.data as { size?: string }).size ?? "—")); },
    };
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(), columns: [SIZE_COL] });
    expect(root.querySelectorAll(".pc-btable-head .pc-btable-th").length).toBe(4); // seal, name, size, source
    expect(rowByName(root, "Elf").querySelector(".col-size")?.textContent).toBe("medium");
  });

  it("defaultExpandSlug opens its row by default when nothing is expanded (smoke r6)", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), {
      ...baseOpts(), selectedSlug: "srd-2024_human", expandSelect: true, defaultExpandSlug: "srd-2024_human",
    });
    expect(root.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    // The expanded block belongs to the default (chosen) row.
    expect(root.querySelector(".pc-btable-expand .pc-bblock-fallback")?.textContent).toBe("Human");
  });

  it("defaultExpandSlug yields to an explicitly expanded row, then re-seeds when that one is closed (smoke r6)", () => {
    const bag = new Map<string, unknown>();
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(bag), {
      ...baseOpts(), selectedSlug: "srd-2024_human", expandSelect: true, defaultExpandSlug: "srd-2024_human",
    });
    // Solo-expand the OTHER row — the default yields (transient swap).
    rowByName(root, "Elf").click();
    expect(root.querySelector(".pc-btable-expand .pc-bblock-fallback")?.textContent).toBe("Elf");
    // Close it: on the next render the resting default (Human) re-seeds.
    rowByName(root, "Elf").click();
    const root2 = mountContainer();
    renderEntityPicker(root2, fakeCtx(bag), {
      ...baseOpts(), selectedSlug: "srd-2024_human", expandSelect: true, defaultExpandSlug: "srd-2024_human",
    });
    expect(root2.querySelector(".pc-btable-expand .pc-bblock-fallback")?.textContent).toBe("Human");
  });

  it("excluded slugs never render a row", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(), exclude: new Set(["srd-5e_elf"]) });
    const names = [...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toEqual(["Human"]);
  });

  it("shows the table's No-matches state when the query matches nothing", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelectorAll(".pc-btable-row").length).toBe(0);
    expect(root.querySelector(".pc-btable-empty")?.textContent).toBe("No matches.");
  });
});
