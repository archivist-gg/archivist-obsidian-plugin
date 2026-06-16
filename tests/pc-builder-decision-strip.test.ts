/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionStrip, renderStripInfoRow, domainPill, applyChoiceToggle, childLabel } from "../src/modules/pc/components/builder/decision-strip";
import { DecisionPickModal } from "../src/modules/pc/components/builder/decision-modal";
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

  it("renders a live select-inline item's unresolved child as a FLAT amber sub-choice (no nested row)", () => {
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
    // The child flattens into the parent's group — NO own border-bearing row, no pill.
    const group = nest.querySelector(".pc-dstrip-fgroup")!;
    expect(group.querySelector(".pc-dstrip-row")).toBeNull();
    expect(group.querySelector(".pc-dstrip-pill")).toBeNull();
    const fc = group.querySelector(".pc-dstrip-fc")!;
    // Unresolved → amber partial dress + "!" flag; sub-label names the real
    // sub-choice (humanized from id "drow-spell"), not the parent featureName.
    expect(fc.classList.contains("partial")).toBe(true);
    expect(fc.querySelector(".pc-dstrip-fc-flag")!.textContent).toBe("!");
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Drow Spell");
    expect(fc.textContent).not.toContain("Elven Lineage");
    expect(fc.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
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

  it("a select-entity item with >12 candidates and picks renders chips + inline Change ghost, NO inline table", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [bigEntityItem(70, ["w-0", "w-1"])],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const nest = c.querySelector(".pc-dstrip-nest")!;
    expect(nest.querySelector(".pc-btable")).toBeNull();                 // no inline table
    expect(nest.querySelector(".pc-dstrip-tlabel")!.textContent).toContain("choose 3");
    expect(nest.querySelectorAll(".pc-bchoice-chip.sel").length).toBe(2); // current picks as chips
    // smoke r4: with picks made, the ghost is a compact inline "Change ▸" living
    // on the chips line (not a prominent "Browse all N").
    const browse = nest.querySelector(".pc-dstrip-browse") as HTMLElement;
    expect(browse).not.toBeNull();
    expect(browse.classList.contains("compact")).toBe(true);
    expect(browse.textContent).toContain("Change ▸");
    expect(browse.textContent).not.toContain("Browse all");
    expect(browse.parentElement!.classList.contains("pc-bchoice-chips")).toBe(true); // same line as chips
  });

  it("an UNRESOLVED long-list (no picks) renders the prominent 'Browse all N ▸' ghost, no chips", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [bigEntityItem(70)],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const nest = c.querySelector(".pc-dstrip-nest")!;
    expect(nest.querySelector(".pc-btable")).toBeNull();
    expect(nest.querySelectorAll(".pc-bchoice-chip.sel").length).toBe(0);
    const browse = nest.querySelector(".pc-dstrip-browse") as HTMLElement;
    expect(browse).not.toBeNull();
    expect(browse.classList.contains("compact")).toBe(false);
    expect(browse.textContent).toContain("Browse all 70");
  });

  it("the ghost opens the DecisionPickModal in BOTH the unresolved and resolved modes", () => {
    const openSpy = vi.spyOn(DecisionPickModal.prototype, "open").mockImplementation(() => {});
    try {
      // Unresolved: "Browse all N ▸" opens the modal.
      const c1 = mountContainer();
      renderDecisionStrip(c1, mkCtx({ setChoice: vi.fn() }), {
        items: [bigEntityItem(70)], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
      });
      (c1.querySelector(".pc-dstrip-browse") as HTMLElement).click();
      expect(openSpy).toHaveBeenCalledTimes(1);

      // Resolved: the compact "Change ▸" opens the same modal.
      const c2 = mountContainer();
      renderDecisionStrip(c2, mkCtx({ setChoice: vi.fn() }), {
        items: [bigEntityItem(70, ["w-0", "w-1"])], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
      });
      (c2.querySelector(".pc-dstrip-browse.compact") as HTMLElement).click();
      expect(openSpy).toHaveBeenCalledTimes(2);
    } finally {
      openSpy.mockRestore();
    }
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

  // ── chosen-feat children (SP2 Plan 5) ──
  // A class-scope feat select-entity with an ability-points child (key
  // "feat:asi") must render the ±-stepper inside the parent's nest, and a +
  // click must write the namespaced key through setChoice at the parent's level.
  it("renders a chosen-feat ability-points child stepper and writes the namespaced feat:asi key", () => {
    const c = mountContainer();
    const setChoice = vi.fn();
    const child = item({
      key: "feat:asi", source: { kind: "class" } as never, level: 4,
      featureName: "Ability Score Improvement",
      choice: { kind: "ability-points", id: "asi", points: 2, max_per: 2 } as never,
      options: [
        { value: "str", label: "STR" }, { value: "dex", label: "DEX" }, { value: "con", label: "CON" },
        { value: "int", label: "INT" }, { value: "wis", label: "WIS" }, { value: "cha", label: "CHA" },
      ],
      selected: undefined, status: "unresolved",
    });
    const featItem = item({
      key: "feat", source: { kind: "class" } as never, level: 4, featureName: "Ability Score Improvement",
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never,
      options: [], selected: "srd-2024_ability-score-improvement", status: "partial", children: [child],
    });
    renderDecisionStrip(c, mkCtx({ setChoice }), {
      items: [featItem], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    // The child stepper renders inside the parent's nest as a FLAT child — no
    // nested .pc-dstrip-row border, no own pill; the sub-label reads "Ability
    // points" (the feat:asi id mapped), not the parent's featureName.
    const nest = c.querySelector(".pc-dstrip-nest")!;
    const group = nest.querySelector(".pc-dstrip-fgroup")!;
    expect(group.querySelector(".pc-dstrip-row")).toBeNull();
    const childFc = [...group.querySelectorAll(".pc-dstrip-fc")].find((r) =>
      r.querySelector(".pc-bpoints"),
    )!;
    expect(childFc).not.toBeUndefined();
    expect(childFc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Ability points");
    expect(childFc.textContent).not.toContain("Ability Score Improvement");
    expect(childFc.querySelectorAll(".pc-bpoints-cell").length).toBe(6);
    // A + click writes the namespaced key at the feat's level.
    (childFc.querySelectorAll(".pc-bpoints-cell")[0].querySelectorAll("button")[1] as HTMLElement).click();
    expect(setChoice).toHaveBeenCalledWith(0, 4, "feat:asi", { str: 1 });
  });

  // ── Variant II flat-child dress (SP2 Plan 5) ──
  it("a RESOLVED child renders the quiet dress with a ✓ and KEEPS its chips mounted", () => {
    const c = mountContainer();
    const child = item({
      key: "feat:spell-list",
      featureName: "Ability Score Improvement",
      choice: { kind: "select-inline", id: "spell-list", count: 1, options: [] } as never,
      options: [
        { value: "cleric", label: "Cleric" },
        { value: "druid", label: "Druid" },
        { value: "wizard", label: "Wizard" },
      ],
      selected: "wizard",
      status: "resolved",
    });
    const parent = item({
      key: "feat", source: { kind: "class" } as never, level: 4, featureName: "Ability Score Improvement",
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never,
      options: [], selected: "srd-2024_magic-initiate", status: "resolved", children: [child],
    });
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [parent], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const fc = c.querySelector(".pc-dstrip-fgroup .pc-dstrip-fc")!;
    expect(fc.classList.contains("quiet")).toBe(true);
    expect(fc.classList.contains("partial")).toBe(false);
    expect(fc.querySelector(".pc-dstrip-fc-flag")).toBeNull();        // no amber "!" when resolved
    expect(fc.querySelector(".pc-dstrip-fc-ok")!.textContent).toBe("✓");
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Spell list");
    expect(fc.querySelectorAll(".pc-bchoice-chip").length).toBe(3);   // controls stay mounted
    expect(fc.querySelector(".pc-bchoice-chip.sel")!.textContent).toContain("Wizard");
  });

  it("a PARTIAL child renders the amber dress with a '!' flag and a 'k picked' label", () => {
    const c = mountContainer();
    const child = item({
      key: "feat:skills",
      featureName: "Ability Score Improvement",
      choice: { kind: "select-proficiency", id: "skills", count: 3, domain: "skill" } as never,
      options: [
        { value: "acrobatics", label: "Acrobatics" },
        { value: "arcana", label: "Arcana" },
        { value: "athletics", label: "Athletics" },
        { value: "stealth", label: "Stealth" },
      ],
      selected: ["acrobatics"],
      status: "partial",
    });
    const parent = item({
      key: "feat", source: { kind: "class" } as never, level: 4, featureName: "Ability Score Improvement",
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never,
      options: [], selected: "srd-2024_skilled", status: "partial", children: [child],
    });
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [parent], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const fc = c.querySelector(".pc-dstrip-fgroup .pc-dstrip-fc")!;
    expect(fc.classList.contains("partial")).toBe(true);
    expect(fc.querySelector(".pc-dstrip-fc-flag")!.textContent).toBe("!");
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Skills — choose 3 · 1 picked");
    expect(fc.querySelectorAll(".pc-bchoice-chip").length).toBe(4);
  });

  // ── child long-list header (smoke r4) ──
  // A feat CHILD whose registry-backed entity pick has a long candidate list
  // (the flat L4 → Feat → Magic Initiate nesting) must NOT re-emit the
  // parent-derived `.pc-dstrip-tlabel` header inside the child: the
  // `.pc-dstrip-fcl` sub-label (childLabel → "Feat") already precedes the
  // control. The control must NEVER surface the inherited parent featureName.
  it("a long-list feat CHILD suppresses the tlabel and never shows the parent featureName", () => {
    const c = mountContainer();
    const featChild = item({
      key: "feat", source: { kind: "class" } as never, level: 4,
      featureName: "Ability Score Improvement",        // inherited parent name — must NOT leak
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never,
      options: Array.from({ length: 18 }, (_, i) => entityOpt(`feat-${i}`)),  // long list
      selected: undefined, status: "unresolved",
    });
    const parent = item({
      key: "asi-or-feat", source: { kind: "class" } as never, level: 4,
      featureName: "Ability Score Improvement",
      choice: { kind: "select-inline", id: "asi-or-feat", count: 1, options: [] } as never,
      options: [{ value: "feat", label: "Take a Feat" }], selected: "feat",
      status: "partial", children: [featChild],
    });
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [parent], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const fc = [...c.querySelectorAll(".pc-dstrip-fgroup .pc-dstrip-fc")].find((r) =>
      r.querySelector(".pc-dstrip-browse"),
    )!;
    expect(fc).not.toBeUndefined();
    // The child's own sub-label names the sub-choice (childLabel → "Feat").
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Feat");
    // No parent-derived caps header inside the child…
    expect(fc.querySelector(".pc-dstrip-tlabel")).toBeNull();
    // …and the inherited parent featureName never appears anywhere in the child.
    expect(fc.textContent).not.toContain("Ability Score Improvement");
    // The long-list ghost still renders (unresolved → "Browse all 18 ▸").
    expect((fc.querySelector(".pc-dstrip-browse") as HTMLElement).textContent).toContain("Browse all 18");
  });

  it("grandchildren FLATTEN into one group (Skilled-shaped): no nested .pc-dstrip-row borders", () => {
    const c = mountContainer();
    // select-inline shape branch → its selected branch carries a skills child.
    const skills = item({
      key: "feat:skills",
      featureName: "Ability Score Improvement",
      choice: { kind: "select-proficiency", id: "skills", count: 3, domain: "skill" } as never,
      options: [
        { value: "acrobatics", label: "Acrobatics" },
        { value: "arcana", label: "Arcana" },
        { value: "stealth", label: "Stealth" },
      ],
      selected: ["acrobatics"],
      status: "partial",
    });
    const shape = item({
      key: "feat:shape",
      featureName: "Ability Score Improvement",
      choice: { kind: "select-inline", id: "proficiency-shape", count: 1, options: [] } as never,
      options: [{ value: "three-skills", label: "Three skills" }],
      selected: "three-skills",
      status: "partial",
      children: [skills],
    });
    const feat = item({
      key: "feat", source: { kind: "class" } as never, level: 4, featureName: "Ability Score Improvement",
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never,
      options: [], selected: "srd-2024_skilled", status: "partial", children: [shape],
    });
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [feat], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    // Exactly one top-level bordered row (the feat parent); zero child borders.
    expect(c.querySelectorAll(".pc-dstrip-row").length).toBe(1);
    const group = c.querySelector(".pc-dstrip-fgroup")!;
    expect(group.querySelector(".pc-dstrip-row")).toBeNull();
    // Both the shape child AND the grandchild live in the SAME flat group.
    // humanizeSlug title-cases the unknown id; CSS uppercases it for display.
    const names = [...group.querySelectorAll(".pc-dstrip-fc-name")].map((n) => n.textContent);
    expect(names).toContain("Proficiency Shape");
    expect(names).toContain("Skills — choose 3 · 1 picked");
    // Only ONE L-pill total (on the top-level row).
    expect(c.querySelectorAll(".pc-dstrip-pill").length).toBe(1);
  });

  // ── synthesized subclass pick (Fix B) routes through setSubclass ──
  // The engine's guarantee emits a registry-backed subclass select-entity (key
  // "subclass"); the strip must render its inline candidate table and route a
  // pick to setSubclass, NOT setChoice (writeValue dispatches on entity_type).
  it("renders the synthesized subclass pick's candidate table and writes via setSubclass", () => {
    const c = mountContainer();
    const setSubclass = vi.fn();
    const subclassItem = item({
      key: "subclass", source: { kind: "class" } as never, level: 3, featureName: "Bard Subclass",
      choice: { kind: "select-entity", id: "subclass", count: 1, entity_type: "subclass",
        where: { parent_class: "self" } } as never,
      options: [
        { value: "srd-2024_college-of-lore", label: "College of Lore",
          entity: { ...registeredEntity("srd-2024_college-of-lore"), name: "College of Lore", entityType: "subclass" } as never },
        { value: "srd-2024_college-of-valor", label: "College of Valor",
          entity: { ...registeredEntity("srd-2024_college-of-valor"), name: "College of Valor", entityType: "subclass" } as never },
      ],
      selected: undefined, status: "unresolved",
    });
    renderDecisionStrip(c, mkCtx({ setSubclass, setChoice: vi.fn() }), {
      items: [subclassItem], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const nest = c.querySelector(".pc-dstrip-nest")!;
    // ≤12 candidates → inline selection table.
    expect(nest.querySelector(".pc-btable")).not.toBeNull();
    expect(nest.querySelector(".pc-dstrip-tlabel")!.textContent).toContain("choose 1");
    // The Lore row's toggle button selects it; writeValue routes the single pick
    // through setSubclass (not setChoice).
    const loreRow = [...nest.querySelectorAll(".pc-btable-row")].find(
      (r) => r.querySelector(".pc-btable-name")!.textContent === "College of Lore",
    )!;
    (loreRow.querySelector(".pc-btoggle") as HTMLElement).click();
    expect(setSubclass).toHaveBeenCalledWith(0, "srd-2024_college-of-lore");
  });

  // ── Manually collapsible top-level rows (SP2 Plan 5, smoke r5) ──
  // Every live top-level decision row is collapsible. Default = expanded ALWAYS,
  // including after the decision resolves (never auto-collapse on resolve).
  // Collapse is strictly user-initiated, hides the nest, keeps the header +
  // ✓/status summary + flips the chevron, and persists across re-renders.
  describe("manually collapsible rows", () => {
    const liveItem = (over: Partial<DecisionItem> = {}): DecisionItem =>
      item({ status: "resolved", selected: "wood-elf", ...over });

    it("a RESOLVED row is EXPANDED by default — chips mounted, no chevron", () => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), { items: [liveItem()], pill: domainPill, live: true, stateKey: "t" });
      const row = c.querySelector(".pc-dstrip-row")!;
      // nest + chips present (always-open default survives a resolved row).
      expect(row.querySelector(".pc-dstrip-nest")).not.toBeNull();
      expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
      // header + ✓ summary visible, state class retained.
      expect(row.classList.contains("done")).toBe(true);
      expect(row.querySelector(".pc-dstrip-val")!.textContent).toContain("Wood Elf");
      // no chevron glyph — the clickable head IS the collapse affordance.
      expect(row.querySelector(".pc-dstrip-chev")).toBeNull();
    });

    it("clicking the head collapses the row — nest/chips gone, header + ✓ + state stay", () => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), { items: [liveItem()], pill: domainPill, live: true, stateKey: "t" });
      const head = c.querySelector(".pc-dstrip-head") as HTMLElement;
      head.click();
      const row = c.querySelector(".pc-dstrip-row")!;
      // nest + chips are gone.
      expect(row.querySelector(".pc-dstrip-nest")).toBeNull();
      expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
      // header line survives: name, ✓ summary, state class.
      expect(row.classList.contains("done")).toBe(true);
      expect(row.querySelector(".pc-dstrip-name")!.textContent).toContain("Elven Lineage");
      expect(row.querySelector(".pc-dstrip-val")!.textContent).toContain("Wood Elf");
      // still no chevron glyph.
      expect(row.querySelector(".pc-dstrip-chev")).toBeNull();
    });

    it("a second head click re-expands the row", () => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), { items: [liveItem()], pill: domainPill, live: true, stateKey: "t" });
      (c.querySelector(".pc-dstrip-head") as HTMLElement).click();   // collapse
      expect(c.querySelector(".pc-dstrip-nest")).toBeNull();
      (c.querySelector(".pc-dstrip-head") as HTMLElement).click();   // re-expand
      const row = c.querySelector(".pc-dstrip-row")!;
      expect(row.querySelector(".pc-dstrip-nest")).not.toBeNull();
      expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
      expect(row.querySelector(".pc-dstrip-chev")).toBeNull();
    });

    it("collapse state persists across a fresh render with the same ctx (builderUiState)", () => {
      const c = mountContainer();
      const ctx = mkCtx();
      const opts = { items: [liveItem()], pill: domainPill, live: true, stateKey: "t" } as const;
      renderDecisionStrip(c, ctx, { ...opts });
      (c.querySelector(".pc-dstrip-head") as HTMLElement).click();   // collapse → writes to bag
      // Re-render the strip into a fresh container with the SAME ctx/bag.
      const c2 = mountContainer();
      renderDecisionStrip(c2, ctx, { ...opts });
      const row = c2.querySelector(".pc-dstrip-row")!;
      expect(row.querySelector(".pc-dstrip-nest")).toBeNull();        // still collapsed
    });

    it("clicking a CHIP in the nest does NOT collapse the row (and still writes)", () => {
      const c = mountContainer();
      const setOriginChoice = vi.fn();
      renderDecisionStrip(c, mkCtx({ setOriginChoice }), {
        items: [liveItem()], pill: domainPill, live: true, stateKey: "t",
      });
      // Click a non-selected chip (Drow) inside the nest.
      const drow = [...c.querySelectorAll(".pc-bchoice-chip")].find((ch) =>
        ch.textContent!.includes("Drow"),
      ) as HTMLElement;
      drow.click();
      // The nest is still present (no collapse) and the write fired.
      expect(c.querySelector(".pc-dstrip-nest")).not.toBeNull();
      expect(setOriginChoice).toHaveBeenCalledWith("race:elven-lineage", "drow");
    });

    it("an informational row has NO chevron / head wrapper (no toggle)", () => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), {
        items: [item({ status: "informational" })], pill: domainPill, live: true, stateKey: "t",
      });
      const row = c.querySelector(".pc-dstrip-row.info")!;
      expect(row.querySelector(".pc-dstrip-chev")).toBeNull();
      expect(row.querySelector(".pc-dstrip-head")).toBeNull();
    });

    it("a renderStripInfoRow row has NO chevron (origin-feat keeps its own expand)", () => {
      const c = mountContainer();
      const row = renderStripInfoRow(c, { pill: "Feat", name: "Origin Feat", value: "Magic Initiate ▸" });
      expect(row.querySelector(".pc-dstrip-chev")).toBeNull();
      expect(row.querySelector(".pc-dstrip-head")).toBeNull();
    });

    it("browse mode (live:false) rows have NO chevron / head wrapper (no controls to toggle)", () => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), { items: [item({})], pill: domainPill, live: false, stateKey: "t" });
      const row = c.querySelector(".pc-dstrip-row.req")!;
      expect(row.querySelector(".pc-dstrip-chev")).toBeNull();
      expect(row.querySelector(".pc-dstrip-head")).toBeNull();
    });
  });
});

// ── Decision descriptions (smoke r7) ──
// A top-level live row carrying a `description` renders it as a quiet markdown
// block at the TOP of the row's nest, BEFORE the control. Children and browse
// rows never render it. The markdown path is the shared renderer; the jsdom
// mock's MarkdownRenderer sets textContent = source synchronously, so the table
// markdown lands as text (we assert structure + content, not parsed table HTML).
describe("renderDecisionStrip — row descriptions", () => {
  const ELVEN_TABLE =
    "Choose a lineage.\n\n| Lineage | Benefit |\n| --- | --- |\n| Drow | Darkvision |\n| Wood Elf | Speed |";

  it("renders the description as a .pc-dstrip-desc block at the TOP of the nest, before the control", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({ description: ELVEN_TABLE })], pill: domainPill, live: true, stateKey: "t",
    });
    const nest = c.querySelector(".pc-dstrip-nest")!;
    const desc = nest.querySelector(".pc-dstrip-desc")!;
    expect(desc).not.toBeNull();
    // The desc block precedes the chips control in DOM order (top of the nest).
    const children = [...nest.children];
    expect(children.indexOf(desc as Element)).toBeLessThan(
      children.findIndex((el) => el.querySelector(".pc-bchoice-chip") || el.classList.contains("pc-bchoice-chips")),
    );
    // The shared markdown path ran: the pipe-table source is present in the block
    // (the jsdom mock renders source text; real Obsidian renders a <table>).
    expect(desc.textContent).toContain("| Lineage | Benefit |");
  });

  it("does NOT render a desc block when the item carries no description", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({})], pill: domainPill, live: true, stateKey: "t" });
    expect(c.querySelector(".pc-dstrip-desc")).toBeNull();
  });

  it("browse rows (live:false) never render the desc block", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({ description: ELVEN_TABLE })], pill: domainPill, live: false, stateKey: "t",
    });
    expect(c.querySelector(".pc-dstrip-desc")).toBeNull();
  });

  it("a child's description is never surfaced as a desc block (children skip)", () => {
    const c = mountContainer();
    const child = item({
      key: "drow-spell", featureName: "Drow Spell",
      choice: { kind: "select-inline", id: "drow-spell", count: 1, options: [] } as never,
      options: [{ value: "dancing-lights", label: "Dancing Lights" }],
      selected: undefined, status: "unresolved",
      // even if a child carried a description, it must NOT render one.
      description: "child desc that must not show",
    });
    const parent = item({ status: "resolved", selected: "drow", description: ELVEN_TABLE, children: [child] });
    renderDecisionStrip(c, mkCtx(), { items: [parent], pill: domainPill, live: true, stateKey: "t" });
    // Exactly ONE desc block — the parent's — never the child's.
    const descs = [...c.querySelectorAll(".pc-dstrip-desc")];
    expect(descs.length).toBe(1);
    expect(descs[0].textContent).not.toContain("child desc that must not show");
    // The desc lives in the top-level nest, not inside the flat child group.
    expect(c.querySelector(".pc-dstrip-fgroup .pc-dstrip-desc")).toBeNull();
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

describe("childLabel", () => {
  const child = (id: string, over: Partial<DecisionItem> = {}): DecisionItem =>
    item({
      key: id,
      featureName: "Ability Score Improvement",  // inherited name — never the label
      choice: { kind: "select-inline", id, count: 1, options: [] } as never,
      options: [],
      selected: undefined,
      status: "unresolved",
      ...over,
    });

  it("strips a feat: key prefix and special-cases the known ids", () => {
    // Spec literal case: a feat:asi choice.id → "Ability points" (prefix stripped).
    expect(childLabel(child("feat:asi", {
      choice: { kind: "ability-points", id: "feat:asi", points: 2, max_per: 2 } as never,
    }))).toBe("Ability points");
    // And the un-prefixed asi id maps the same.
    expect(childLabel(child("asi", {
      choice: { kind: "ability-points", id: "asi", points: 2, max_per: 2 } as never,
    }))).toBe("Ability points");
    expect(childLabel(child("feat", {
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never,
    }))).toBe("Feat");
    expect(childLabel(child("spell-list", {
      choice: { kind: "select-inline", id: "spell-list", count: 1, options: [] } as never,
    }))).toBe("Spell list");
    expect(childLabel(child("spellcasting-ability", {
      choice: { kind: "select-inline", id: "spellcasting-ability", count: 1, options: [] } as never,
    }))).toBe("Spellcasting ability");
  });

  it("falls back to a humanized slug for an unknown id", () => {
    expect(childLabel(child("eldritch-blessing", {
      choice: { kind: "select-inline", id: "eldritch-blessing", count: 1, options: [] } as never,
    }))).toBe("Eldritch Blessing");
  });

  it("appends the requirement for a multi-pick in progress, bare otherwise", () => {
    // single-pick → bare label.
    expect(childLabel(child("spell-list"))).toBe("Spell list");
    // choose-3, 1 picked → "k picked" suffix.
    expect(childLabel(child("feat:skills", {
      choice: { kind: "select-proficiency", id: "skills", count: 3, domain: "skill" } as never,
      selected: ["acrobatics"],
    }))).toBe("Skills — choose 3 · 1 picked");
    // choose-3, none picked → bare requirement, no "0 picked".
    expect(childLabel(child("feat:skills", {
      choice: { kind: "select-proficiency", id: "skills", count: 3, domain: "skill" } as never,
      selected: undefined,
    }))).toBe("Skills — choose 3");
  });
});
