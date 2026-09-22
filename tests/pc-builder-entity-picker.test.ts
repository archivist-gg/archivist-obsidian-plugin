/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { renderEntityPicker } from "../packages/obsidian/src/modules/pc/components/builder/entity-picker";
import { closeCompendiumFilterPopover } from "../packages/obsidian/src/modules/pc/components/builder/compendium-filter";
import type { ColSpec } from "../packages/obsidian/src/modules/pc/components/builder/selection-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";

beforeAll(() => installObsidianDomHelpers());

afterEach(() => {
  closeCompendiumFilterPopover();
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

const races: RegisteredEntity[] = [
  { slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "elf.md",
    data: { name: "Elf", edition: "2014", size: "medium" }, compendium: "SRD 5e", readonly: true, homebrew: false },
  { slug: "srd-2024_human", name: "Human", entityType: "race", filePath: "human.md",
    data: { name: "Human", edition: "2024", size: "medium" }, compendium: "SRD 2024", readonly: true, homebrew: false },
];

const SRD_COMPS = ["SRD 5e", "SRD 2024"];

function fakeCtx(
  bag: Map<string, unknown>, hidden: string[] = [], list: RegisteredEntity[] = races, comps: string[] = SRD_COMPS,
): ComponentRenderContext {
  return {
    services: {
      plugin: { settings: { hiddenCompendiums: hidden } },
      entities: {
        search: (q: string, type: string) =>
          list.filter((r) => r.entityType === type && r.name.toLowerCase().includes(q.toLowerCase())),
      },
      compendiums: { getAll: () =>
        comps.map((name) => ({ name, description: "", readonly: true, homebrew: false, folderPath: "" })) },
      modules: { getByEntityType: () => undefined }, // expand falls back to the name line
    },
    builderUiState: bag,
  } as unknown as ComponentRenderContext;
}

const baseOpts = (onSelect = vi.fn()) =>
  ({ entityType: "race", stateKey: "p", selectedSlug: null, onSelect });

const pop = (): HTMLElement | null => document.body.querySelector<HTMLElement>(".pc-bfilter-pop");
const popRows = (): [string | null, string | null][] =>
  [...pop()!.querySelectorAll(".pc-bfilter-row")].map((r) =>
    [r.querySelector(".pc-bfilter-name")!.textContent, r.querySelector(".pc-bfilter-n")!.textContent]);
const boxOf = (name: string): HTMLInputElement =>
  [...pop()!.querySelectorAll<HTMLElement>(".pc-bfilter-row")]
    .find((r) => r.querySelector(".pc-bfilter-name")?.textContent === name)!
    .querySelector<HTMLInputElement>("input")!;

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

  it("the compendium filter is a button on the search row", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const bar = root.querySelector(".pc-bpicker-bar")!;
    expect(bar.querySelector(".pc-bpicker-search")).not.toBeNull();
    expect(bar.querySelector(".pc-bfilter-btn")).not.toBeNull();
  });

  it("unticking a compendium in the popover hides its rows", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    root.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    boxOf("SRD 2024").click();
    const names = [...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toEqual(["Elf"]);
  });

  it("a tick survives typing: the button node is not rebuilt by the table redraw", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const btn = root.querySelector<HTMLElement>(".pc-bfilter-btn")!;
    btn.click();
    boxOf("SRD 2024").click();
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "e";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelector(".pc-bfilter-btn")).toBe(btn);
    expect(btn.querySelector(".pc-bfilter-btn-v")!.textContent).toBe("1 of 2");
  });

  it("the popover's counts come from the whole list, not the current search", () => {
    // The query is SEEDED (a persisted search surviving a re-render): the counts
    // are taken at render time, so typing after it could not tell them apart.
    const bag = new Map<string, unknown>([["p", { query: "hum", ticked: null }]]);
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(bag), baseOpts());
    expect([...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent)).toEqual(["Human"]);
    root.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    // Natural order, as Obsidian's file explorer sorts: 5 before 2024.
    expect(popRows()).toEqual([["SRD 5e", "1"], ["SRD 2024", "1"]]);
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

  it("excluded slugs are not counted: with one compendium left there is nothing to filter", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(), exclude: new Set(["srd-5e_elf"]) });
    expect(root.querySelector(".pc-bfilter-btn")).toBeNull();
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

describe("compendium visibility (F2)", () => {
  it("a hidden compendium is absent from the popover and its rows are gone", () => {
    const dwarf: RegisteredEntity = {
      slug: "me_dwarf", name: "Dwarf", entityType: "race", filePath: "dwarf.md",
      data: { name: "Dwarf", size: "medium" }, compendium: "Me", readonly: false, homebrew: true,
    };
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map(), ["SRD 5e"], [...races, dwarf], [...SRD_COMPS, "Me"]), baseOpts());
    root.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    expect(popRows()).toEqual([["Me", "1"], ["SRD 2024", "1"]]);
    const names = [...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toEqual(["Dwarf", "Human"]);
  });

  it("stale persisted ticked state cannot resurrect a hidden compendium", () => {
    const bag = new Map<string, unknown>();
    bag.set("p", { query: "", ticked: { ticked: new Set(["SRD 5e", "SRD 2024"]) } });
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(bag, ["SRD 5e"]), baseOpts());
    const names = [...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toEqual(["Human"]);
  });

  it("selected-exemption: the current selection's row survives hiding its compendium", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map(), ["SRD 5e"]),
      { ...baseOpts(), selectedSlug: "srd-5e_elf" });
    const names = [...root.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toContain("Elf");
    expect(names).toContain("Human");
  });
});
