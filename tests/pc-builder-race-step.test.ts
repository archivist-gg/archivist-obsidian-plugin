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

// ── Task 5: expanded-row composition (subrace + racial decisions) ────────────

// Entity-data shape the picker hands `renderExpand` (carries subraces + a trait
// choice). The race-block merges traits by `subraces[].slug`; the trait choice
// is a select-inline (no registry needed to enumerate).
const DWARF_DATA = {
  name: "Dwarf", size: "medium", speed: { walk: 25 },
  subraces: [{ slug: "hill-dwarf", name: "Hill Dwarf" }, { slug: "mountain-dwarf", name: "Mountain Dwarf" }],
  traits: [{
    name: "Tool Proficiency",
    choices: [{ kind: "select-inline", id: "dwarf-tools", count: 1, options: [
      { value: "smith", label: "Smith's tools" }, { value: "brewer", label: "Brewer's supplies" },
    ] }],
  }],
};

const DWARF_ROW: RegisteredEntity = {
  slug: "srd-5e_dwarf", name: "Dwarf", entityType: "race", filePath: "x", readonly: true,
  homebrew: false, compendium: "SRD 5e", data: DWARF_DATA,
} as unknown as RegisteredEntity;

/** Build a ctx with the dwarf chosen: definition.race wikilink, the resolver-
 *  shaped `resolved.race` the engine reads, and the picker table's expanded set
 *  seeded so the dwarf row restores open at render. The fake registry's
 *  getByTypeAndSlug returns undefined — the trait's select-inline needs none. */
function mkCtxWithChosenDwarf(
  data: typeof DWARF_DATA,
  over: { setSubrace?: unknown; subrace?: string | null } = {},
): ComponentRenderContext {
  const races: RegisteredEntity[] = [
    DWARF_ROW,
    { slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "x", readonly: true,
      homebrew: false, compendium: "SRD 5e", data: { name: "Elf", size: "medium", speed: { walk: 30 } } } as unknown as RegisteredEntity,
  ];
  // Resolver-shaped race entity the decision engine reads (slug/name/choices/traits).
  const resolvedRace = { slug: "srd-5e_dwarf", name: data.name, choices: [], traits: data.traits };
  const builderUiState = new Map<string, unknown>();
  builderUiState.set("builder.race-picker.table", {
    sortKey: "name", sortDir: "asc", expanded: new Set(["srd-5e_dwarf"]),
  });
  return {
    resolved: {
      definition: { race: "[[srd-5e_dwarf]]", subrace: over.subrace ?? null, origin_choices: {}, class: [] },
      race: resolvedRace, background: null, classes: [], features: [],
    },
    derived: {},
    core: {
      plugin: {},
      entities: {
        search: (_q: string, type: string) => (type === "race" ? races : []),
        getByTypeAndSlug: () => undefined,
      },
      compendiums: { getAll: () => [{ name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" }] },
      modules: { getByEntityType: () => undefined },
    },
    editState: over.setSubrace ? { setRace: vi.fn(), setSubrace: over.setSubrace } : null,
    builderUiState,
  } as unknown as ComponentRenderContext;
}

/** Seed the picker table's expanded set so a non-chosen row restores open. */
function expandRowFor(ctx: ComponentRenderContext, slug: string): void {
  ctx.builderUiState!.set("builder.race-picker.table", {
    sortKey: "name", sortDir: "asc", expanded: new Set([slug]),
  });
}

describe("renderRaceStep — expanded composition", () => {
  it("chosen race's expanded row shows the subrace callout and racial decision items", () => {
    const container = mountContainer();
    const ctx = mkCtxWithChosenDwarf(DWARF_DATA);
    renderRaceStep(container, ctx);
    expect(container.textContent).toContain("Subrace");
    expect(container.textContent).toContain("Hill Dwarf");
    expect(container.textContent).toContain("Tool Proficiency");
  });

  it("subrace chip click writes setSubrace; re-click clears it", () => {
    const container = mountContainer();
    const setSubrace = vi.fn();
    const ctx = mkCtxWithChosenDwarf(DWARF_DATA, { setSubrace });
    renderRaceStep(container, ctx);
    const chip = [...container.querySelectorAll(".pc-bchoice-chip")].find((c) => c.textContent?.includes("Hill Dwarf"));
    (chip as HTMLElement).click();
    expect(setSubrace).toHaveBeenCalledWith("hill-dwarf");
  });

  it("with the subrace already chosen, clicking its chip clears it (setSubrace null)", () => {
    const container = mountContainer();
    const setSubrace = vi.fn();
    const ctx = mkCtxWithChosenDwarf(DWARF_DATA, { setSubrace, subrace: "[[hill-dwarf]]" });
    renderRaceStep(container, ctx);
    const chip = [...container.querySelectorAll(".pc-bchoice-chip")].find((c) => c.textContent?.includes("Hill Dwarf"));
    (chip as HTMLElement).click();
    expect(setSubrace).toHaveBeenCalledWith(null);
  });

  it("a non-chosen race's expanded row shows only the entity block (no subrace/decisions)", () => {
    const container = mountContainer();
    const ctx = mkCtxWithChosenDwarf(DWARF_DATA); // elf row expanded while dwarf is chosen
    expandRowFor(ctx, "srd-5e_elf");
    renderRaceStep(container, ctx);
    const expand = container.querySelector(".pc-btable-expand");
    expect(expand?.textContent).not.toContain("Subrace");
  });
});
