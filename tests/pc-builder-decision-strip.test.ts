/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionStrip, renderStripInfoRow, domainPill, applyChoiceToggle } from "../src/modules/pc/components/builder/decision-strip";
import type { DecisionItem, ResolvedOption } from "../src/modules/pc/pc.decision-engine";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const registeredEntity = (slug: string): RegisteredEntity =>
  ({
    slug, name: slug.toUpperCase(), entityType: "weapon", filePath: `Compendium/${slug}.md`,
    data: { edition: "2024" }, compendium: "SRD 5.2", readonly: true, homebrew: false,
  }) as unknown as RegisteredEntity;

const item = (over: Partial<DecisionItem>): DecisionItem =>
  ({
    key: "elven-lineage",
    source: { kind: "race" },
    level: 0,
    featureName: "Elven Lineage",
    choice: { kind: "select-inline", id: "elven-lineage", count: 1, options: [] },
    options: [
      { value: "drow", label: "Drow" },
      { value: "wood-elf", label: "Wood Elf" },
    ],
    selected: undefined,
    status: "unresolved",
    ...over,
  }) as DecisionItem;

const mkCtx = (editState: Record<string, unknown> = {}): ComponentRenderContext =>
  ({ resolved: { definition: {} }, derived: {}, core: { entities: {} }, editState, builderUiState: new Map() }) as unknown as ComponentRenderContext;

describe("renderDecisionStrip", () => {
  it("unresolved row wears the open dress with chips mounted", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({})], pill: domainPill, live: true, stateKey: "t" });
    const row = c.querySelector(".pc-dstrip-row")!;
    expect(row.classList.contains("open")).toBe(true);
    expect(row.querySelector(".pc-dstrip-bang")).not.toBeNull();
    expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
  });

  it("resolved row wears green but KEEPS its chips (always-open)", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({ status: "resolved", selected: "wood-elf" })],
      pill: domainPill, live: true, stateKey: "t",
    });
    const row = c.querySelector(".pc-dstrip-row")!;
    expect(row.classList.contains("done")).toBe(true);
    expect(row.querySelector(".pc-dstrip-bang")).toBeNull();
    expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
    expect(row.querySelector(".pc-bchoice-chip.sel")!.textContent).toContain("Wood Elf");
    expect(row.querySelector(".pc-dstrip-val")!.textContent).toContain("Wood Elf");
  });

  it("chip click writes the origin choice", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    renderDecisionStrip(c, mkCtx({ setOriginChoice }), { items: [item({})], pill: domainPill, live: true, stateKey: "t" });
    (c.querySelector(".pc-bchoice-chip") as HTMLElement).click();
    expect(setOriginChoice).toHaveBeenCalledWith("race:elven-lineage", "drow");
  });

  it("browse mode renders rows without controls", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({})], pill: domainPill, live: false, stateKey: "t" });
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
    expect(c.querySelector(".pc-dstrip-row.req")).not.toBeNull();
  });

  it("informational item renders featureName only, quietly", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({ status: "informational" })], pill: domainPill, live: true, stateKey: "t" });
    const row = c.querySelector(".pc-dstrip-row.info")!;
    expect(row.textContent).toContain("Elven Lineage");
    expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
  });

  it("ability-points renders the pc-bpoints stepper, always mounted, caps enforced", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    const it_ = item({
      key: "abilities",
      source: { kind: "background" } as never,
      featureName: "Ability Scores",
      choice: { kind: "ability-points", id: "abilities", points: 3, max_per: 2, pool: ["int", "wis", "cha"] } as never,
      options: [
        { value: "int", label: "INT" }, { value: "wis", label: "WIS" }, { value: "cha", label: "CHA" },
      ],
      selected: { int: 2 },
      status: "partial",
    });
    renderDecisionStrip(c, mkCtx({ setOriginChoice }), { items: [it_], pill: domainPill, live: true, stateKey: "t" });
    expect(c.querySelectorAll(".pc-bpoints-cell").length).toBe(3);
    // INT is at max_per → its + is disabled
    const intPlus = c.querySelectorAll(".pc-bpoints-cell")[0].querySelectorAll("button")[1] as HTMLButtonElement;
    expect(intPlus.disabled).toBe(true);
    // WIS + writes the merged allocation
    (c.querySelectorAll(".pc-bpoints-cell")[1].querySelectorAll("button")[1] as HTMLElement).click();
    expect(setOriginChoice).toHaveBeenCalledWith("background:abilities", { int: 2, wis: 1 });
  });

  it("resolved ability-points keeps the stepper mounted (always-open)", () => {
    const c = mountContainer();
    const it_ = item({
      key: "abilities", source: { kind: "background" } as never, featureName: "Ability Scores",
      choice: { kind: "ability-points", id: "abilities", points: 3, max_per: 2, pool: ["int", "wis", "cha"] } as never,
      options: [{ value: "int", label: "INT" }, { value: "wis", label: "WIS" }, { value: "cha", label: "CHA" }],
      selected: { int: 2, wis: 1 }, status: "resolved",
    });
    renderDecisionStrip(c, mkCtx(), { items: [it_], pill: domainPill, live: true, stateKey: "t" });
    expect(c.querySelector(".pc-dstrip-row")!.classList.contains("done")).toBe(true);
    expect(c.querySelectorAll(".pc-bpoints-cell").length).toBe(3);
  });

  it("renderStripInfoRow renders the quiet fixed-grant row", () => {
    const c = mountContainer();
    const row = renderStripInfoRow(c, { pill: "Feat", name: "Origin Feat", value: "Magic Initiate (Cleric) ▸" });
    expect(row.classList.contains("info")).toBe(true);
    expect(row.querySelector(".pc-dstrip-val")!.textContent).toContain("Magic Initiate");
  });

  it("renders a live select-inline item's unresolved child inside the parent's nest", () => {
    const c = mountContainer();
    const child = item({
      key: "drow-spell",
      featureName: "Drow Spell",
      choice: { kind: "select-inline", id: "drow-spell", count: 1, options: [] } as never,
      options: [
        { value: "dancing-lights", label: "Dancing Lights" },
        { value: "faerie-fire", label: "Faerie Fire" },
      ],
      selected: undefined,
      status: "unresolved",
    });
    const parent = item({ status: "resolved", selected: "drow", children: [child] });
    renderDecisionStrip(c, mkCtx(), { items: [parent], pill: domainPill, live: true, stateKey: "t" });
    const nest = c.querySelector(".pc-dstrip-row .pc-dstrip-nest")!;
    // The child row renders inside the parent's nest, with its own name + control.
    const childRow = [...nest.querySelectorAll(".pc-dstrip-row")].find((r) =>
      r.textContent?.includes("Drow Spell"),
    )!;
    expect(childRow).not.toBeUndefined();
    expect(childRow.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
  });

  it("a missing option renders inert and does not write on click", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    const it_ = item({
      options: [
        { value: "drow", label: "Drow" },
        { value: "ghost-elf", label: "Ghost Elf", missing: true } as never,
      ],
    });
    renderDecisionStrip(c, mkCtx({ setOriginChoice }), { items: [it_], pill: domainPill, live: true, stateKey: "t" });
    const inert = c.querySelector(".pc-bchoice-chip.inert")!;
    expect(inert.textContent).toMatch(/\(missing\)$/);
    (inert as HTMLElement).click();
    expect(setOriginChoice).not.toHaveBeenCalled();
  });

  it("clicking the selected chip of a resolved choose-1 row deselects (writes null)", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    renderDecisionStrip(c, mkCtx({ setOriginChoice }), {
      items: [item({ status: "resolved", selected: "drow" })],
      pill: domainPill, live: true, stateKey: "t",
    });
    const selChip = c.querySelector(".pc-bchoice-chip.sel") as HTMLElement;
    expect(selChip.textContent).toContain("Drow");
    selChip.click();
    expect(setOriginChoice).toHaveBeenCalledWith("race:elven-lineage", null);
  });

  // ── Long select-entity lists open a filtered picker modal (smoke r1) ──
  // A registry-backed select-entity item (no `from`) with many candidates must
  // NOT splat the full table inline; instead it shows the current picks as
  // chips + a "Browse all N ▸" ghost. Small lists keep the inline table.
  const entityOpt = (slug: string): ResolvedOption => ({
    value: slug, label: slug, entity: registeredEntity(slug),
  });
  const bigEntityItem = (count: number, selected: string[] = []): DecisionItem =>
    item({
      key: "weapon-mastery", source: { kind: "class" } as never, level: 1,
      featureName: "Weapon Mastery",
      choice: { kind: "select-entity", id: "weapon-mastery", count: 3, entity_type: "weapon" } as never,
      options: Array.from({ length: count }, (_, i) => entityOpt(`w-${i}`)),
      selected: selected.length ? selected : undefined,
      status: selected.length >= 3 ? "resolved" : "unresolved",
    });

  it("a select-entity item with >12 candidates renders chips + Browse ghost, NO inline table", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [bigEntityItem(70, ["w-0", "w-1"])],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const nest = c.querySelector(".pc-dstrip-nest")!;
    expect(nest.querySelector(".pc-btable")).toBeNull();                 // no inline table
    expect(nest.querySelector(".pc-dstrip-tlabel")!.textContent).toContain("choose 3");
    expect(nest.querySelectorAll(".pc-bchoice-chip.sel").length).toBe(2); // current picks as chips
    const browse = nest.querySelector(".pc-dstrip-browse") as HTMLElement;
    expect(browse).not.toBeNull();
    expect(browse.textContent).toContain("Browse all 70");
  });

  it("a select-entity item with ≤12 candidates still renders the inline table (regression pin)", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [bigEntityItem(12)],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const nest = c.querySelector(".pc-dstrip-nest")!;
    expect(nest.querySelector(".pc-btable")).not.toBeNull();
    expect(nest.querySelector(".pc-dstrip-browse")).toBeNull();
  });

  it("clicking a sel chip in the long-list mode removes that pick (writeValue with reduced array)", () => {
    const c = mountContainer();
    const setChoice = vi.fn();
    renderDecisionStrip(c, mkCtx({ setChoice }), {
      items: [bigEntityItem(70, ["w-0", "w-1"])],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const chips = [...c.querySelectorAll(".pc-bchoice-chip.sel")] as HTMLElement[];
    chips[0].click();
    expect(setChoice).toHaveBeenCalledWith(0, 1, "weapon-mastery", ["w-1"]);
  });
});

describe("domainPill", () => {
  it("maps kinds deterministically", () => {
    expect(domainPill(item({}))).toBe("Lineage");
    expect(domainPill(item({ choice: { kind: "select-inline", id: "spellcasting-ability", count: 1, options: [] } as never }))).toBe("Ability");
    expect(domainPill(item({ choice: { kind: "ability-points", id: "abilities", points: 3, max_per: 2, pool: [] } as never }))).toBe("Ability");
    expect(domainPill(item({ choice: { kind: "select-proficiency", id: "skill", count: 1, domain: "skill", from: [] } as never }))).toBe("Skill");
    expect(domainPill(item({ choice: { kind: "select-proficiency", id: "languages", count: 2, domain: "language" } as never }))).toBe("Lang");
    expect(domainPill(item({ choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never }))).toBe("Feat");
    expect(domainPill(item({ choice: { kind: "select-inline", id: "", count: 1, options: [] } as never }))).toBe("Pick");
  });
});

describe("applyChoiceToggle", () => {
  it("toggles membership under the limit", () => {
    const sel = new Set<string>();
    applyChoiceToggle(sel, "stealth", 2);
    expect([...sel]).toEqual(["stealth"]);
    applyChoiceToggle(sel, "stealth", 2);
    expect(sel.size).toBe(0);
  });

  it("choose-1 swaps instead of refusing", () => {
    const sel = new Set<string>(["athletics"]);
    applyChoiceToggle(sel, "stealth", 1);
    expect([...sel]).toEqual(["stealth"]);
  });

  it("choose-N refuses additions beyond the limit", () => {
    const sel = new Set<string>(["athletics", "stealth"]);
    applyChoiceToggle(sel, "arcana", 2);
    expect(sel.has("arcana")).toBe(false);
    expect(sel.size).toBe(2);
  });

  it("choose-0 refuses all additions but still allows removal", () => {
    const sel = new Set<string>();
    applyChoiceToggle(sel, "athletics", 0);
    expect(sel.size).toBe(0);
    const stale = new Set<string>(["athletics"]);
    applyChoiceToggle(stale, "athletics", 0);
    expect(stale.size).toBe(0);
  });
});
