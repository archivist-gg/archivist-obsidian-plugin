/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderAddDrawer } from "../src/modules/pc/components/spells/add-drawer";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

vi.mock("../src/modules/spell/spell.renderer", () => ({
  renderSpellBlock: vi.fn(() => Promise.resolve(document.createElement("div"))),
}));

vi.mock("../src/modules/pc/components/spells/reset-filters-modal", () => ({
  confirmResetFilters: (_app: unknown, onConfirm: () => void) => onConfirm(),
}));

beforeAll(() => installObsidianDomHelpers());

const REG = buildMockRegistry([
  { slug: "fire-bolt", name: "Fire Bolt", entityType: "spell", data: {
    name: "Fire Bolt", level: 0, classes: ["wizard"], edition: "2024",
    school: "evocation", casting_time: "action", range: "120 feet", components: "V, S",
    damage: { types: ["fire"] } } },
  { slug: "bless", name: "Bless", entityType: "spell", data: {
    name: "Bless", level: 1, classes: ["wizard"], edition: "2014",
    school: "enchantment", casting_time: "action", range: "30 feet", components: "V, S, M",
    concentration: true, duration: "1 minute" } },
  { slug: "misty-step", name: "Misty Step", entityType: "spell", data: {
    name: "Misty Step", level: 2, classes: ["wizard"], edition: "2014",
    school: "conjuration", casting_time: "bonus-action", range: "Self" } },
]);

function ctx(known: string[] = [], editState: object = { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() }): ComponentRenderContext {
  return {
    resolved: { spells: known.map((slug) => ({ slug })) } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 1: 4, 2: 3 }, pactMagic: null } as never,
    core: { entities: REG } as never, app: {} as never, editState: editState as never,
  };
}

const rowNames = (root: HTMLElement) =>
  [...root.querySelectorAll(".pc-spell-add-table tbody .pc-add-name")].map((n) => n.textContent);

describe("renderAddDrawer — table", () => {
  it("renders a table with the expected header columns", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    const heads = [...root.querySelectorAll(".pc-spell-add-table thead th")].map((h) => h.textContent?.trim());
    expect(heads).toEqual(["", "Name", "Level ▲", "Time", "School", "Range", "Components", "Source", "Damage", "Save", "Duration"]);
  });

  it("one row per candidate, default sort = level ascending", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    expect(rowNames(root)).toEqual(["Fire Bolt", "Bless", "Misty Step"]);
  });

  it("concentration/ritual show as badges in the name cell, not as columns", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    // Bless is the concentration spell in the fixture → a .pc-spell-cr.c badge.
    const blessCell = [...root.querySelectorAll(".pc-spell-add-table tbody td.col-name")].find(
      (td) => td.querySelector(".pc-add-name")?.textContent === "Bless",
    ) as HTMLElement;
    expect(blessCell.querySelector(".pc-spell-cr.c")?.textContent).toBe("C");
    // No standalone concentration/ritual columns remain.
    expect(root.querySelector(".pc-spell-add-table td.col-conc")).toBeNull();
    expect(root.querySelector(".pc-spell-add-table td.col-ritual")).toBeNull();
  });

  it("＋ adds an unknown spell; ✓ removes a known one", () => {
    const root = mountContainer();
    const addKnownSpell = vi.fn(); const removeKnownSpell = vi.fn();
    renderAddDrawer(root, ctx(["bless"], { addKnownSpell, removeKnownSpell }));
    const add = root.querySelector(".pc-spell-add-table tbody tr .pc-add-toggle:not(.on)") as HTMLElement;
    add.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(addKnownSpell).toHaveBeenCalledWith("fire-bolt", { class: "wizard" });
    const on = root.querySelector(".pc-add-toggle.on") as HTMLElement;
    on.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(removeKnownSpell).toHaveBeenCalledWith("bless");
  });

  it("clicking a row expands a spell block row; toggle click does not", () => {
    const root = mountContainer();
    const addKnownSpell = vi.fn();
    renderAddDrawer(root, ctx([], { addKnownSpell, removeKnownSpell: vi.fn() }));
    const firstRow = root.querySelector(".pc-spell-add-table tbody tr.pc-spell-add-row") as HTMLElement;
    firstRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-spell-expand-row")).not.toBeNull();
    firstRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-spell-expand-row")).toBeNull();
    (root.querySelector(".pc-add-toggle") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-spell-expand-row")).toBeNull();
    expect(addKnownSpell).toHaveBeenCalled();
  });

  it("clicking a row toggles .pc-row-open on the add row", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx([], { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() }));
    const firstRow = root.querySelector(".pc-spell-add-table tbody tr.pc-spell-add-row") as HTMLElement;
    expect(firstRow.classList.contains("pc-row-open")).toBe(false);
    firstRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(firstRow.classList.contains("pc-row-open")).toBe(true);
    firstRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(firstRow.classList.contains("pc-row-open")).toBe(false);
  });

  it("clicking the Name header sorts by name; clicking again flips direction", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    const nameTh = [...root.querySelectorAll(".pc-spell-add-table thead th")].find((h) => h.textContent?.trim().startsWith("Name")) as HTMLElement;
    nameTh.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Bless", "Fire Bolt", "Misty Step"]);
    const nameTh2 = [...root.querySelectorAll(".pc-spell-add-table thead th")].find((h) => h.textContent?.trim().startsWith("Name")) as HTMLElement;
    nameTh2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Misty Step", "Fire Bolt", "Bless"]);
  });

  it("Source chip multi-selects (OR) — 2024 alone shows only 2024 spells", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    const chip = [...root.querySelectorAll(".pc-spell-addbar-primary .pc-spell-fchip")].find((c) => c.textContent === "2024") as HTMLElement;
    chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Fire Bolt"]);
  });

  it("Level chip narrows to a level", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    const chip = [...root.querySelectorAll(".pc-spell-addbar-primary .pc-spell-fchip")].find((c) => c.textContent === "1st") as HTMLElement;
    chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Bless"]);
  });

  it("optional columns carry .col-* classes so CSS can hide them responsively", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    for (const cls of ["col-save", "col-damage", "col-comp", "col-dur", "col-time", "col-range"]) {
      expect(root.querySelector(`.pc-spell-add-table td.${cls}`)).not.toBeNull();
    }
  });
});

describe("renderAddDrawer — More filters", () => {
  const openMore = (root: HTMLElement) =>
    (root.querySelector(".pc-spell-morebtn") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const panelChip = (root: HTMLElement, text: string) =>
    [...root.querySelectorAll(".pc-spell-morepanel .pc-spell-fchip")].find((c) => c.textContent === text) as HTMLElement;

  it("More button toggles the panel", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    expect(root.querySelector(".pc-spell-morepanel")).toBeNull();
    openMore(root);
    expect(root.querySelector(".pc-spell-morepanel")).not.toBeNull();
  });

  it("School filter narrows (AND across groups)", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    openMore(root);
    panelChip(root, "Conj").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Misty Step"]); // only conjuration spell
  });

  it("Damage multi-select is OR within the group", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    openMore(root);
    panelChip(root, "Fire").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Fire Bolt"]);
  });

  it("Concentration flag requires concentration", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    openMore(root);
    panelChip(root, "Concentration").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Bless"]);
  });

  it("active hidden sections show a count badge on More", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    openMore(root);
    panelChip(root, "Conj").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-spell-morebadge")?.textContent).toBe("1");
  });
});

describe("renderAddDrawer — Reset", () => {
  it("Reset (after confirm) clears active filters", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    (root.querySelector(".pc-spell-morebtn") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const conj = [...root.querySelectorAll(".pc-spell-morepanel .pc-spell-fchip")].find((c) => c.textContent === "Conj") as HTMLElement;
    conj.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Misty Step"]);

    (root.querySelector(".pc-spell-resetbtn") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowNames(root)).toEqual(["Fire Bolt", "Bless", "Misty Step"]); // all back
    expect(root.querySelector(".pc-spell-morebadge")).toBeNull(); // badge cleared
  });

  it("Reset sits next to More filters in the top bar", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx());
    const top = root.querySelector(".pc-spell-addbar-top") as HTMLElement;
    const kids = [...top.children].map((k) => k.className);
    const iMore = kids.findIndex((c) => c.includes("pc-spell-morebtn"));
    const iReset = kids.findIndex((c) => c.includes("pc-spell-resetbtn"));
    expect(iReset).toBe(iMore + 1);
  });
});
