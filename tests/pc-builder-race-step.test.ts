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
// is a select-inline (no registry needed to enumerate). Carries the folded
// Size/Speed/Darkvision traits (Task 6 folds these into glance tiles), a vision
// block (Darkvision tile + sub-line), and a long-description decision trait.
const DWARF_DATA = {
  name: "Dwarf", size: "medium", speed: { walk: 25 }, vision: { darkvision: 60 },
  description: "Dwarves are a stout and hardy folk.",
  subraces: [{ slug: "hill-dwarf", name: "Hill Dwarf" }, { slug: "mountain-dwarf", name: "Mountain Dwarf" }],
  traits: [
    { name: "Size", description: "Your size is Medium." },
    { name: "Speed", description: "Your base walking speed is 25 feet." },
    { name: "Darkvision", description: "You can see in dim light within 60 feet." },
    {
      name: "Tool Proficiency",
      description: "You gain proficiency with one artisan's tool of your choice. You can use this tool to craft and repair items. The tool you choose reflects your dwarven heritage.",
      choices: [{ kind: "select-inline", id: "dwarf-tools", count: 1, options: [
        { value: "smith", label: "Smith's tools" }, { value: "brewer", label: "Brewer's supplies" },
      ] }],
    },
  ],
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
  data: typeof DWARF_DATA = DWARF_DATA,
  over: { setSubrace?: unknown; subrace?: string | null } = {},
): ComponentRenderContext {
  const dwarfRow: RegisteredEntity =
    data === DWARF_DATA ? DWARF_ROW : ({ ...DWARF_ROW, data } as unknown as RegisteredEntity);
  const races: RegisteredEntity[] = [
    dwarfRow,
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
  it("chosen expansion renders the Chronicle block with strip inside it", () => {
    const c = mountContainer();
    renderRaceStep(c, mkCtxWithChosenDwarf());
    const block = c.querySelector(".pc-btable-expand .pc-cblock")!;
    expect(block.querySelector(".pc-cb-name")!.textContent).toBe("Dwarf");
    expect(block.querySelector(".pc-dstrip")).not.toBeNull();          // strip INSIDE the block
    expect(c.querySelector(".pc-bledger")).toBeNull();                  // old appended ledger gone
  });

  it("chosen expansion shows the subrace row and racial decision items", () => {
    const container = mountContainer();
    renderRaceStep(container, mkCtxWithChosenDwarf());
    expect(container.textContent).toContain("Subrace");
    expect(container.textContent).toContain("Hill Dwarf");
    expect(container.textContent).toContain("Tool Proficiency");
  });

  it("folds Size/Speed/Darkvision traits into tiles and out of the trait list", () => {
    const c = mountContainer();
    renderRaceStep(c, mkCtxWithChosenDwarf());
    const names = [...c.querySelectorAll(".pc-cb-trait-n")].map((n) => n.textContent);
    expect(names).not.toContain("Size");
    expect(names).not.toContain("Speed");
    expect(names).not.toContain("Darkvision");
    expect([...c.querySelectorAll(".pc-cb-tl")].map((n) => n.textContent)).toContain("Darkvision");
  });

  it("tiles are Size / Speed / Darkvision only — the Decisions glance tile is dropped (smoke r6)", () => {
    const c = mountContainer();
    renderRaceStep(c, mkCtxWithChosenDwarf());
    const labels = [...c.querySelectorAll(".pc-cb-tl")].map((n) => n.textContent);
    expect(labels).toEqual(["Size", "Speed", "Darkvision"]);
    expect(labels).not.toContain("Decisions");
    // The strip below still carries the decision count (Tool Proficiency row).
    expect(c.querySelector(".pc-dstrip")).not.toBeNull();
  });

  it("trait with choices carries the decision meta; the FULL description renders with no Read-full toggle (smoke r6)", () => {
    const c = mountContainer();
    renderRaceStep(c, mkCtxWithChosenDwarf());
    const t = [...c.querySelectorAll(".pc-cb-trait")].find((x) => x.querySelector(".pc-cb-trait-meta"))!;
    // The complete multi-sentence description is shown at once.
    const toolTrait = DWARF_DATA.traits.find((tr) => tr.name === "Tool Proficiency")!;
    expect(t.querySelector(".pc-cb-trait-d")!.textContent).toBe(toolTrait.description);
    // No truncation affordance survives in any trait row.
    expect(c.querySelectorAll(".pc-cb-trait .pc-cb-more").length).toBe(0);
  });

  it("a trait description renders through the markdown path; pipe-table content lands in the .pc-cb-trait-d block (smoke r7)", () => {
    const c = mountContainer();
    // A trait whose description carries a markdown pipe table (the Elven-Lineage
    // shape). The jsdom MarkdownRenderer mock sets textContent = source, so the
    // table source is present in the container; real Obsidian renders a <table>.
    const data = {
      ...DWARF_DATA,
      traits: [
        ...DWARF_DATA.traits,
        {
          name: "Stonecunning",
          description: "You gain expertise.\n\n| Tier | Bonus |\n| --- | --- |\n| 1 | +2 |",
        },
      ],
    };
    renderRaceStep(c, mkCtxWithChosenDwarf(data as typeof DWARF_DATA));
    const stone = [...c.querySelectorAll(".pc-cb-trait")].find(
      (t) => t.querySelector(".pc-cb-trait-n")?.textContent === "Stonecunning",
    )!;
    const dd = stone.querySelector(".pc-cb-trait-d")!;
    expect(dd).not.toBeNull();                              // the dress container still exists
    expect(dd.textContent).toContain("| Tier | Bonus |");   // the pipe table reached the markdown renderer
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

  it("a non-chosen race's expanded row shows the block WITHOUT the strip (no subrace/decisions)", () => {
    const container = mountContainer();
    const ctx = mkCtxWithChosenDwarf(DWARF_DATA); // elf row expanded while dwarf is chosen
    expandRowFor(ctx, "srd-5e_elf");
    renderRaceStep(container, ctx);
    const expand = container.querySelector(".pc-btable-expand");
    expect(expand?.querySelector(".pc-cblock")).not.toBeNull();
    expect(expand?.querySelector(".pc-dstrip")).toBeNull();
    expect(expand?.textContent).not.toContain("Subrace");
  });

  it("the chosen race's block ALWAYS shows: its row defaults open with nothing expanded (smoke r6)", () => {
    const container = mountContainer();
    const ctx = mkCtxWithChosenDwarf();
    // No row explicitly expanded — the resting default must open the chosen row.
    ctx.builderUiState!.delete("builder.race-picker.table");
    renderRaceStep(container, ctx);
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    const block = container.querySelector(".pc-btable-expand .pc-cblock")!;
    expect(block.querySelector(".pc-cb-name")!.textContent).toBe("Dwarf");
    expect(block.querySelector(".pc-dstrip")).not.toBeNull();
  });

  it("re-clicking the chosen race's resting-default row is a no-op — the block stays shown (smoke r6)", () => {
    const container = mountContainer();
    const ctx = mkCtxWithChosenDwarf();
    ctx.builderUiState!.delete("builder.race-picker.table");
    renderRaceStep(container, ctx);
    const chosenRow = [...container.querySelectorAll<HTMLElement>(".pc-btable-row")]
      .find((r) => r.querySelector(".pc-btable-name")?.textContent === "Dwarf")!;
    chosenRow.click();
    // Block remains — the chosen row never collapses on re-click.
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    expect(container.querySelector(".pc-btable-expand .pc-cb-name")!.textContent).toBe("Dwarf");
  });
});
