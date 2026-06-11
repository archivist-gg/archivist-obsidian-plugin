/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderRaceStep } from "../src/modules/pc/components/builder/race-step";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const RACES: RegisteredEntity[] = [
  { slug: "srd-5e_dwarf", name: "Dwarf", entityType: "race", filePath: "x", readonly: true, homebrew: false,
    compendium: "SRD 5e", data: { name: "Dwarf", size: "medium", speed: { walk: 25 } } },
  { slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "x", readonly: true, homebrew: false,
    compendium: "SRD 5e", data: { name: "Elf", size: "medium", speed: { walk: 30 } } },
];

function mkCtx(over: { race?: string | null; editState?: unknown } = {}): ComponentRenderContext {
  return {
    resolved: { definition: { race: over.race ?? null, subrace: null, origin_choices: {}, class: [] }, race: null, background: null, classes: [], features: [] },
    derived: {},
    core: {
      plugin: {},
      entities: { search: (_q: string, type: string) => (type === "race" ? RACES : []), getByTypeAndSlug: () => undefined },
      compendiums: { getAll: () => [{ name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" }] },
      modules: { getByEntityType: () => undefined },
    },
    editState: over.editState ?? null,
    builderUiState: new Map(),
  } as unknown as ComponentRenderContext;
}

describe("renderRaceStep", () => {
  it("renders the race ledger with no toggle column", () => {
    const container = mountContainer();
    renderRaceStep(container, mkCtx());
    expect(container.querySelectorAll(".pc-btable-row").length).toBe(2);
    expect(container.querySelectorAll(".pc-btoggle").length).toBe(0);
  });

  it("row click selects the race (setRace) and expands the row", () => {
    const container = mountContainer();
    const setRace = vi.fn();
    renderRaceStep(container, mkCtx({ editState: { setRace } }));
    (container.querySelector(".pc-btable-row") as HTMLElement).click();
    expect(setRace).toHaveBeenCalledWith("srd-5e_dwarf");
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
  });

  it("the chosen race's row shows the crimson name dress + seal", () => {
    const container = mountContainer();
    renderRaceStep(container, mkCtx({ race: "[[srd-5e_elf]]" }));
    const names = [...container.querySelectorAll(".pc-btable-name")];
    const elf = names.find((n) => n.textContent === "Elf");
    expect(elf?.classList.contains("on")).toBe(true);
    expect(container.querySelector(".pc-bname-seal")).toBeTruthy();
  });

  it("re-clicking the chosen race never calls setRace again", () => {
    const container = mountContainer();
    const setRace = vi.fn();
    renderRaceStep(container, mkCtx({ race: "[[srd-5e_dwarf]]", editState: { setRace } }));
    const row = container.querySelector(".pc-btable-row") as HTMLElement;
    row.click();
    row.click();
    expect(setRace).not.toHaveBeenCalled();
  });
});
