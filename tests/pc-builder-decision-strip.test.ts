/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionStrip, renderStripInfoRow, domainPill, applyChoiceToggle, childLabel, STRANDED_TIP } from "../packages/obsidian/src/modules/pc/components/builder/decision-strip";
import { DecisionPickModal } from "../packages/obsidian/src/modules/pc/components/builder/decision-modal";
import type { DecisionItem, ResolvedOption } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";

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
    satisfied: false,
    ...over,
  }) as DecisionItem;

const mkCtx = (editState: Record<string, unknown> = {}): ComponentRenderContext =>
  ({ resolved: { definition: {} }, derived: {}, services: { entities: {} }, editState, builderUiState: new Map() }) as unknown as ComponentRenderContext;

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

  // A choice whose option pool resolves EMPTY must say so. Reaching the chips
  // fall-through with zero options renders a header and nothing clickable, which
  // reads as a broken UI rather than as missing data. `live: true` is load-bearing:
  // in browse mode renderRow returns before renderControl is ever reached.
  it("renders an empty-state line, and no chips row, when a choice has zero options", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({
        key: "tool",
        choice: { kind: "select-proficiency", id: "tool", count: 1, domain: "tool" },
        options: [],            // the whole point: an empty pool
        selected: undefined,
        status: "unresolved",
      })],
      pill: domainPill,
      live: true,               // load-bearing, see above
      stateKey: "t",
    });

    const empty = c.querySelector(".pc-dstrip-empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("No options available for this choice.");
    expect(empty!.textContent).not.toMatch(/compendium/i);
    expect(c.querySelector(".pc-bchoice-chips")).toBeNull();
  });

  // ── `.pc-dstrip-val` on an OPEN row (spec §13.1, §16.3 item 1) ──
  // Previously UNPINNED: all four prior `.pc-dstrip-val` assertions hit the
  // resolved `✓` branch, so `statusText` had no coverage at all. It reported the
  // TOTAL, so after picking 1 of 3 the builder said "choose 3" while the sheet
  // said "choose 2". It now shares `requirementSuffix` with `childLabel`.
  it("an OPEN row's .pc-dstrip-val reports what is REMAINING, not the total", () => {
    const skills = (count: number, selected: string[] | undefined, status: DecisionItem["status"]) =>
      item({
        key: "skills",
        choice: { kind: "select-proficiency", id: "skills", count, domain: "skill" },
        options: [
          { value: "acrobatics", label: "Acrobatics" },
          { value: "arcana", label: "Arcana" },
          { value: "stealth", label: "Stealth" },
        ],
        selected,
        status,
      });
    const valOf = (it_: DecisionItem): string => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), { items: [it_], pill: domainPill, live: true, stateKey: "t" });
      const row = c.querySelector(".pc-dstrip-row")!;
      expect(row.classList.contains("open")).toBe(true);   // NOT the ✓ branch
      return row.querySelector(".pc-dstrip-val")!.textContent!;
    };

    // partial: the "k picked" form, the whole point of the §13.1 fix.
    expect(valOf(skills(3, ["acrobatics"], "partial"))).toBe("choose 3 · 1 picked");
    // nothing picked: bare requirement, never "0 picked".
    expect(valOf(skills(3, undefined, "unresolved"))).toBe("choose 3");
    // single-pick: `requirementSuffix` returns "" (a child's label wants no
    // suffix there), and statusText's `||` fallback keeps "choose 1" alive.
    expect(valOf(skills(1, undefined, "unresolved"))).toBe("choose 1");
    // ability-points keeps its own remaining idiom, untouched by the extraction.
    expect(valOf(item({
      key: "asi",
      choice: { kind: "ability-points", id: "asi", points: 2, max_per: 2 },
      options: [{ value: "str", label: "STR" }, { value: "dex", label: "DEX" }],
      selected: { str: 1 },
      status: "partial",
    }))).toBe("1 point(s) left");
  });

  // ── The satisfied dress (spec §6.3, §13.4) ──
  // A SATISFIED row is one whose pool was non-empty BEFORE exclusion and empty
  // after: the character already holds every language/tool it could grant. The
  // engine resolves it to `resolved`, which creates a shape that did not exist
  // before this phase (`status: "resolved"` with `selected === undefined`), so
  // the ✓ branch renders a bare "✓ " with an empty summary. The nest therefore
  // carries its own honest copy, and it must NOT be P3a's broken-UI string.
  it("a SATISFIED row wears the done dress and gets its own copy, not P3a's", () => {
    const langs = (satisfied: boolean): DecisionItem => item({
      key: "languages",
      choice: { kind: "select-proficiency", id: "languages", count: 2, domain: "language" },
      options: [],              // exclusion emptied the pool
      selected: undefined,
      status: satisfied ? "resolved" : "unresolved",
      satisfied,
    });

    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [langs(true)], pill: domainPill, live: true, stateKey: "t" });
    const row = c.querySelector(".pc-dstrip-row")!;
    expect(row.classList.contains("done")).toBe(true);
    expect(row.querySelector(".pc-dstrip-bang")).toBeNull();
    // §13.4 site 1: `resolved` + no `selected` used to render a bare "✓ " here,
    // because selectedSummary returns "" for a row nobody picked on. The value
    // column now says what is true, in its OWN words: the nest's sentence is on
    // screen at the same time, so the two must not be the same string.
    const val = row.querySelector(".pc-dstrip-val")!.textContent!;
    expect(val).toBe("✓ Nothing left to pick");
    // The `statusText` `||` trap, pinned rather than left latent: if a satisfied
    // row ever routed through statusText, requirementSuffix's "" would fall
    // through to `choose ${requiredOf(item)}` and print "choose 2" on exactly the
    // row the satisfied state exists to silence.
    expect(val).not.toMatch(/choose/i);

    const empty = c.querySelector(".pc-dstrip-empty")!;
    expect(empty.textContent).toBe("You already have every option this choice offers.");
    // Distinct from ALL THREE existing empty strings, and silent about
    // compendiums (visibility is meaningless for a proficiency domain).
    expect(empty.textContent).not.toBe("No options available for this choice.");
    expect(empty.textContent).not.toBe("No options available in your vault yet.");
    expect(empty.textContent).not.toBe(
      "No options available. Some exist in a hidden compendium (see Archivist settings).",
    );
    expect(empty.textContent).not.toMatch(/compendium/i);

    // §6.3's ACCEPTANCE CRITERION for the split: the else-branch is still
    // reachable. The same zero-option item with `satisfied: false` (a
    // `domain:"save"` choice, an empty registry, an authored `from: []`) keeps
    // P3a's string verbatim, so the pin above at `:208` cannot be dead code.
    const c2 = mountContainer();
    renderDecisionStrip(c2, mkCtx(), { items: [langs(false)], pill: domainPill, live: true, stateKey: "t" });
    expect(c2.querySelector(".pc-dstrip-empty")!.textContent)
      .toBe("No options available for this choice.");
    // The two copy strings are on screen together and must stay distinct.
    expect(c.querySelector(".pc-dstrip-empty")!.textContent).not.toBe(val);
  });

  // ── A satisfied row must never HIDE a persisted pick ──
  // `satisfied` does not imply `selected === undefined`. canonicalizeSelection
  // (engine :295-301) keeps a pool no-match verbatim, by design, so a homebrew or
  // legacy value is never erased; the per-choice exemption (engine :375) re-admits
  // only options that are IN the pool. A value OUTSIDE the pool therefore survives
  // while the pool empties around it, and the val column would announce
  // "Nothing left to pick" over the user's own frontmatter.
  it("a SATISFIED row still shows a persisted pick that is outside the pool", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({
        key: "tool",
        choice: { kind: "select-proficiency", id: "tool", count: 1, domain: "tool" },
        options: [],                    // exclusion emptied the enumerated pool
        selected: "grandfather's-lute", // a no-match canonicalizeSelection KEPT
        status: "resolved",
        satisfied: true,
      })],
      pill: domainPill, live: true, stateKey: "t",
    });
    const val = c.querySelector(".pc-dstrip-val")!.textContent!;
    // selectedSummary falls back to the raw slug when no option resolves it.
    expect(val).toBe("✓ grandfather's-lute");
    expect(val).not.toBe("✓ Nothing left to pick");
  });

  // ── A satisfied CHILD row (spec §13.4 site 2, reachable per §5.4) ──
  // `renderChildRow` has its own `done` binding and `childLabel` appends the
  // requirement from `requiredOf`, so before `requirementSuffix`'s satisfied
  // clause a satisfied count:2 child rendered the quiet dress and its ✓ beside
  // "Languages: choose 2": the same incoherence as the parent, one level down.
  it("a SATISFIED child drops the requirement suffix, not just the parent", () => {
    const c = mountContainer();
    const child = item({
      key: "languages",
      choice: { kind: "select-proficiency", id: "languages", count: 2, domain: "language" },
      options: [],              // exclusion emptied the pool
      selected: undefined,
      status: "resolved",
      satisfied: true,
    });
    const parent = item({
      key: "feat", source: { kind: "class", slug: "srd-2024_class_rogue", level: 4 }, level: 4,
      featureName: "Ability Score Improvement",
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" },
      options: [], selected: "srd-2024_skilled", status: "resolved", children: [child],
    });
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [parent], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const fc = c.querySelector(".pc-dstrip-fgroup .pc-dstrip-fc")!;
    expect(fc.classList.contains("quiet")).toBe(true);          // resolved dress
    expect(fc.querySelector(".pc-dstrip-fc-ok")!.textContent).toBe("✓");
    // The bare label, with NO requirement beside the ✓.
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Languages");
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).not.toMatch(/choose/i);
    // And the child's own nest carries the satisfied copy, not P3a's.
    expect(fc.querySelector(".pc-dstrip-empty")!.textContent)
      .toBe("You already have every option this choice offers.");
    // The satisfied clause is scoped: an UNsatisfied count:2 child on the same
    // shape keeps its requirement, so the clause cannot swallow live copy.
    const c2 = mountContainer();
    renderDecisionStrip(c2, mkCtx({ setChoice: vi.fn() }), {
      items: [item({ ...parent, children: [item({ ...child, satisfied: false, status: "unresolved" })] })],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    expect(c2.querySelector(".pc-dstrip-fgroup .pc-dstrip-fc .pc-dstrip-fc-name")!.textContent)
      .toBe("Languages: choose 2");
  });

  // ── `labelOf` names an ENTITY-level origin row by its choice (spec §13.3) ──
  // `pushOrigin` passes the SAME `source` object for the entity-level and the
  // trait-level rows, so only `featureName` discriminates them: the 2024 Soldier
  // rendered three sibling rows all named "Soldier". BOTH predicate clauses are
  // load-bearing and pinned here.
  it("labelOf renames an entity-level origin row, and ONLY that shape", () => {
    const nameOf = (over: Partial<DecisionItem>): string => {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx(), { items: [item(over)], pill: domainPill, live: true, stateKey: "t" });
      return c.querySelector(".pc-dstrip-name")!.textContent!;
    };
    const langChoice = { kind: "select-proficiency", id: "languages", count: 2, domain: "language" };

    // Entity-level: featureName IS the entity name → renamed after the choice.
    expect(nameOf({
      source: { kind: "background", slug: "srd-2024_background_soldier" },
      featureName: "Soldier", choice: langChoice,
    })).toBe("Languages");
    // Same shape on a race, and toProfSlug's fold is why we never hand-roll it.
    expect(nameOf({
      source: { kind: "race", slug: "srd-5e_race_human" },
      featureName: "Human", choice: langChoice,
    })).toBe("Languages");
    // Trait-level: same source object, different featureName → left ALONE.
    // ("Extra Language" is the high-elf's, and it is already correct today.)
    expect(nameOf({
      source: { kind: "race", slug: "srd-5e_race_high-elf" },
      featureName: "Extra Language", choice: langChoice,
    })).toBe("Extra Language");
    // The `kind` clause, NOT decoration: the origin-feat push sets
    // featureName = originFeat.display AND source.slug = feat.slug, so it passes
    // the name test and would be rewritten to "Languages" without it.
    expect(nameOf({
      source: { kind: "feat", slug: "srd-2024_feat_magic-initiate" },
      featureName: "Magic Initiate", choice: langChoice,
    })).toBe("Magic Initiate");
    // Class rows can never be rewritten by construction (the `kind` clause).
    expect(nameOf({
      source: { kind: "class", slug: "srd-2024_class_bard", level: 1 }, level: 1,
      featureName: "Bard", choice: langChoice,
    })).toBe("Bard");
    // An authored `choice.label` still wins: the rewrite sits in the
    // featureName FALLBACK, so homebrew keeps its own copy.
    expect(nameOf({
      source: { kind: "background", slug: "srd-2024_background_soldier" },
      featureName: "Soldier", choice: { ...langChoice, label: "Two Extra Tongues" },
    })).toBe("Two Extra Tongues");
  });

  // ── `data-prof` on the builder chip (spec §10.3 deviation 4, §17 assertion 4) ──
  // The rendered text is a humanized label and is prefixed "✓ " when selected,
  // so it is not addressable by a CSS selector. Without this hook §17's
  // `--expect-absent '.pc-bchoice-chip[data-prof="dwarvish"]'` matches nothing
  // and passes UNCONDITIONALLY, which is a silent false green.
  it("every builder chip carries data-prof with its option value", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({
        key: "languages",
        choice: { kind: "select-proficiency", id: "languages", count: 2, domain: "language" },
        options: [
          { value: "dwarvish", label: "Dwarvish" },
          { value: "elvish", label: "Elvish" },
          { value: "sylvan", label: "Sylvan", missing: true },
        ],
        selected: ["elvish"],
        status: "partial",
      })],
      pill: domainPill, live: true, stateKey: "t",
    });
    const chips = [...c.querySelectorAll(".pc-bchoice-chip")];
    expect(chips.map((n) => n.getAttribute("data-prof")))
      .toEqual(["dwarvish", "elvish", "sylvan"]);
    // The hook survives BOTH text decorations that hide the value.
    expect(c.querySelector('.pc-bchoice-chip[data-prof="elvish"]')!.textContent).toBe("✓ Elvish");
    expect(c.querySelector('.pc-bchoice-chip[data-prof="sylvan"]')!.textContent).toBe("Sylvan (missing)");
    // And the selector §17 asserts absent resolves on the live DOM.
    expect(c.querySelector('.pc-bchoice-chip[data-prof="giant"]')).toBeNull();
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

  // R4 {G5, G6} live rider V-10: the run read `Maneuvers — choose 3` off the open modal. The
  // separator between the label and the count is the arc's `·` in BOTH copies the sentence reaches:
  // the modal heading and the `.pc-dstrip-tlabel` twin the same control writes above it.
  it("the long-list pick separates label from count with '·', in the tlabel and the modal title", () => {
    const titles: string[] = [];
    const openSpy = vi.spyOn(DecisionPickModal.prototype, "open").mockImplementation(function (this: DecisionPickModal) {
      titles.push((this as unknown as { opts: { title: string } }).opts.title);
    });
    try {
      const c = mountContainer();
      renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
        items: [bigEntityItem(70)], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
      });
      const nest = c.querySelector(".pc-dstrip-nest")!;
      expect(nest.querySelector(".pc-dstrip-tlabel")!.textContent).toBe("Weapon Mastery · choose 3");
      (nest.querySelector(".pc-dstrip-browse") as HTMLElement).click();
      expect(titles).toEqual(["Weapon Mastery · choose 3"]);
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
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Skills: choose 3 · 1 picked");
    expect(fc.querySelectorAll(".pc-bchoice-chip").length).toBe(4);
  });

  // ── flat top-level feat pick, long list (R4-P4) ──
  // The SRD's authored two-step `select-inline#asi-or-feat` is normalized into a
  // FLAT top-level `select-entity` feat pick, so no SRD output nests a feat
  // child any more: there is no child group, and the parent-derived
  // `.pc-dstrip-tlabel` header RENDERS, because `inChild` is false.
  // This is NOT a claim that the child shape is gone. `flattenAsiOrFeat` is a
  // permanent compatibility layer keyed strictly on the `asi-or-feat` id, so a
  // feat `select-entity` CHILD stays reachable via homebrew it returns
  // untouched · the test below this one covers that scope.
  // What was wrong with the version this replaced: it modelled the two-step
  // shape as SRD output and built the items by hand, so it stayed green while
  // asserting the exact inverse of what the SRD path now produces.
  it("a flat top-level feat pick renders its own tlabel and no child row", () => {
    const flatItem = item({
      key: "feat", level: 4, featureName: "Ability Score Improvement",
      source: { kind: "class", slug: "srd-5e_class_wizard", level: 4 },
      choice: { kind: "select-entity", id: "feat", entity_type: "feat", count: 1 },
      options: Array.from({ length: 18 }, (_, i) => entityOpt(`feat-${i}`)),
      selected: undefined, status: "unresolved", satisfied: false,
    });
    const root = mountContainer();
    renderDecisionStrip(root, mkCtx({ setChoice: vi.fn() }), {
      items: [flatItem], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });

    // The child group is gone: a flat pick has no children until a feat is picked.
    expect(root.querySelector(".pc-dstrip-fgroup")).toBeNull();
    expect(root.querySelector(".pc-dstrip-fc")).toBeNull();

    // The tlabel now RENDERS, because `inChild` is false at the top level.
    const tlabel = root.querySelector(".pc-dstrip-tlabel")!;
    // Do NOT delete this as redundant-after-the-`!`: the `!` is a compile-time
    // assertion only, and this line is the sole detector for a mutation that
    // drops the header. Without it the failure degrades to a TypeError.
    expect(tlabel).not.toBeNull();
    // Two `toContain` rather than one exact-string assertion on the whole tlabel:
    // the separator the renderer puts between the label and "choose 1" is U+2014
    // today and P8 will change it, so pinning the full string would couple this
    // test to a phase that has not run.
    expect(tlabel.textContent).toContain("Ability Score Improvement");
    expect(tlabel.textContent).toContain("choose 1");

    // Binding decision 8: the browse affordance is KEPT.
    expect(root.querySelector(".pc-dstrip-browse")!.textContent).toContain("Browse all 18");
  });

  // ── homebrew two-step feat, CHILD scope (R4-P4) ──
  // The suppression side of the `!inChild` guard at decision-strip.ts:464, which
  // the flat test above cannot reach. `flattenAsiOrFeat` (dnd5e
  // pc.asi-flatten.ts:19-31) is keyed strictly on `id === "asi-or-feat"` and
  // returns its input BY IDENTITY otherwise (`:20`), so a differently-keyed
  // homebrew `select-inline` keeps its feat `select-entity` child all the way
  // into the render. Its own docstring calls it a permanent compatibility layer,
  // not a migration shim.
  // In child scope the `.pc-dstrip-fcl` sub-label (childLabel) already names the
  // sub-choice and carries the requirement, so the control must NOT re-emit the
  // parent-derived `.pc-dstrip-tlabel`: that is the "FEAT FEAT" duplication
  // decision-strip.ts:237-241 exists to prevent. A child inherits the parent's
  // `featureName` verbatim · BOTH of `buildItem`'s child recursions in dnd5e
  // `pc.decision-engine.ts` (the select-inline branch reveal and the chosen-feat
  // expansion) pass `featureName` straight through. Cited by SYMBOL, not line:
  // a `:428` here went stale the moment a dnd5e commit on this same branch added
  // lines above it, and no plugin-side check catches a cross-repo line move.
  // So an unsuppressed header would also leak that name into the child row.
  it("a feat CHILD of a homebrew two-step parent suppresses the tlabel and hides the parent featureName", () => {
    const c = mountContainer();
    const hbSource = { kind: "class", slug: "hb_class_illrigger", level: 4 } as const;
    const featChild = item({
      key: "feat", source: hbSource, level: 4,
      featureName: "Diabolic Boon",   // inherited from the parent verbatim, must NOT leak
      choice: { kind: "select-entity", id: "feat", entity_type: "feat", count: 1 },
      options: Array.from({ length: 18 }, (_, i) => entityOpt(`feat-${i}`)),  // long list
      selected: undefined, status: "unresolved", satisfied: false,
    });
    const parent = item({
      key: "boon-or-feat", source: hbSource, level: 4,
      featureName: "Diabolic Boon",
      // Deliberately NOT the `asi-or-feat` id: that is what keeps this shape
      // reachable, because flattenAsiOrFeat returns it untouched.
      choice: { kind: "select-inline", id: "boon-or-feat", count: 1, options: [] },
      options: [{ value: "feat", label: "Take a Feat" }], selected: "feat",
      status: "partial", satisfied: false, children: [featChild],
    });
    renderDecisionStrip(c, mkCtx({ setChoice: vi.fn() }), {
      items: [parent], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const fc = [...c.querySelectorAll(".pc-dstrip-fgroup .pc-dstrip-fc")].find((r) =>
      r.querySelector(".pc-dstrip-browse"),
    )!;
    expect(fc).not.toBeUndefined();
    // The child's own sub-label names the sub-choice, and it is the ONLY label
    // the child gets (childLabel maps the `feat` key to "Feat").
    expect(fc.querySelector(".pc-dstrip-fc-name")!.textContent).toBe("Feat");
    // The suppression itself: no parent-derived caps header inside the child.
    expect(fc.querySelector(".pc-dstrip-tlabel")).toBeNull();
    // And the inherited parent featureName never surfaces anywhere in the child.
    expect(fc.textContent).not.toContain("Diabolic Boon");
    // The long-list ghost still renders in child scope (unresolved, 18 > threshold).
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
    expect(names).toContain("Skills: choose 3 · 1 picked");
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

// ── Compendium visibility (F6) ──────────────────────────────────────────────
// A registry-backed select-entity pick (kind "select-entity", no `from`) is
// resolved by the engine into item.options[].entity. Hidden compendiums drop
// those candidates from the NEW-pick surfaces (inline table + long-list browse),
// exempting the current selection; a two-tier empty copy distinguishes "hidden
// by settings" from "vault has none". Since R4-G5 §3.2.2 the `from` chips arm
// applies the SAME predicate, so sheet and builder answer one rule; an option
// with no `entity` (a `missing` slug, and every non-entity choice kind) carries
// no compendium and is kept.
describe("compendium visibility (F6)", () => {
  const HIDDEN = "SRD 5e";
  const VISIBLE = "SRD 2024";

  // An entity pinned to a named compendium, with a display NAME distinct from
  // its raw slug (so a "renders by name" assertion can't pass on the slug).
  const compEntity = (slug: string, name: string, compendium: string): RegisteredEntity =>
    ({ ...registeredEntity(slug), name, compendium }) as unknown as RegisteredEntity;
  const compOpt = (slug: string, name: string, compendium: string): ResolvedOption =>
    ({ value: slug, label: name, entity: compEntity(slug, name, compendium) });

  // A registry-backed select-entity row (no `from`) over the given options.
  const selectEntityItem = (options: ResolvedOption[], over: Partial<DecisionItem> = {}): DecisionItem =>
    item({
      key: "weapon-mastery", source: { kind: "class" } as never, level: 1,
      featureName: "Weapon Mastery",
      choice: { kind: "select-entity", id: "weapon-mastery", count: 1, entity_type: "weapon" } as never,
      options, selected: undefined, status: "unresolved",
      ...over,
    });

  // ctx whose services carry a live plugin.settings with hidden compendiums.
  const ctxHiding = (...hiddenCompendiums: string[]): ComponentRenderContext =>
    ({
      resolved: { definition: {} }, derived: {},
      services: { entities: {}, plugin: { settings: { hiddenCompendiums } } },
      editState: { setChoice: vi.fn() }, builderUiState: new Map(),
    }) as unknown as ComponentRenderContext;

  it("registry-backed select-entity candidates from hidden compendiums are filtered", () => {
    const c = mountContainer();
    // item: select-entity, no `from`, two options (one per compendium), nothing
    // selected → the inline table rows contain only the SRD 2024 entity.
    renderDecisionStrip(c, ctxHiding(HIDDEN), {
      items: [selectEntityItem([
        compOpt("longsword", "Longsword", HIDDEN),
        compOpt("rapier", "Rapier", VISIBLE),
      ])],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const names = [...c.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toEqual(["Rapier"]);
    expect(names).not.toContain("Longsword");
  });

  it("selected-exemption: a selected hidden-compendium option keeps its row/chip", () => {
    const c = mountContainer();
    // same item with item.selected = the SRD 5e entity's slug → its row still
    // renders by NAME, not the raw slug (the exemption predicate keeps it).
    renderDecisionStrip(c, ctxHiding(HIDDEN), {
      items: [selectEntityItem([
        compOpt("longsword", "Longsword", HIDDEN),
        compOpt("rapier", "Rapier", VISIBLE),
      ], { selected: "longsword", status: "resolved" })],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    const names = [...c.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).toContain("Longsword");      // selected hidden option retained…
    expect(names).not.toContain("longsword");  // …by NAME, not the raw slug.
  });

  it("filtering to empty shows the hidden-aware copy, not 'in your vault yet'", () => {
    const c = mountContainer();
    // item whose options ALL sit in "SRD 5e" → candidates empty, allCandidates
    // non-empty → the hidden-aware empty copy.
    renderDecisionStrip(c, ctxHiding(HIDDEN), {
      items: [selectEntityItem([
        compOpt("longsword", "Longsword", HIDDEN),
        compOpt("shortsword", "Shortsword", HIDDEN),
      ])],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    expect(c.querySelector(".pc-dstrip-empty")!.textContent)
      .toBe("No options available. Some exist in a hidden compendium (see Archivist settings).");
  });

  it("a genuinely empty option list keeps the original copy", () => {
    const c = mountContainer();
    // item with zero options → allCandidates empty too → the original copy.
    renderDecisionStrip(c, ctxHiding(HIDDEN), {
      items: [selectEntityItem([])],
      pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    expect(c.querySelector(".pc-dstrip-empty")!.textContent)
      .toBe("No options available in your vault yet.");
  });

  it("R4-G5 §3.2.2: an explicit `from` chips list IS filtered, on the SAME predicate as the table arm", () => {
    const c = mountContainer();
    // select-entity WITH `from` (the chips arm): both options sit in the hidden compendium and NEITHER
    // is selected, so both chips go. Before R4-G5 this arm applied no filter and rendered 2 chips.
    const fromItem = selectEntityItem([
      compOpt("longsword", "Longsword", HIDDEN),
      compOpt("shortsword", "Shortsword", HIDDEN),
    ], {
      choice: {
        kind: "select-entity", id: "weapon-mastery", count: 1, entity_type: "weapon",
        from: ["longsword", "shortsword"],
      } as never,
    });
    renderDecisionStrip(c, ctxHiding(HIDDEN), {
      items: [fromItem], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t",
    });
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
    expect(c.querySelector(".pc-dstrip-empty")!.textContent)
      .toBe("No options available. Some exist in a hidden compendium (see Archivist settings).");
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
    }))).toBe("Skills: choose 3 · 1 picked");
    // choose-3, none picked → bare requirement, no "0 picked".
    expect(childLabel(child("feat:skills", {
      choice: { kind: "select-proficiency", id: "skills", count: 3, domain: "skill" } as never,
      selected: undefined,
    }))).toBe("Skills: choose 3");
  });

  // requirementSuffix's UPPER bound (`have < need`), previously unpinned: all
  // other coverage is 1-of-3 or 0-of-3, so `have === need` was never exercised
  // and dropping the bound to `have > 0` moved no assertion in the file. It is
  // NOT equivalent: a FULLY-selected multi-pick is done, and "choose 2 · 2
  // picked" is noise on a row with nothing left to do. The lower bound
  // (`have > 0`) is pinned by the "none picked" case above; this pins the top.
  it("drops the 'k picked' tail once the multi-pick is FULL, at every arity", () => {
    const full = (count: number, selected: string[]) => childLabel(child("feat:skills", {
      choice: { kind: "select-proficiency", id: "skills", count, domain: "skill" } as never,
      selected,
    }));
    expect(full(2, ["acrobatics", "arcana"])).toBe("Skills: choose 2");
    expect(full(3, ["acrobatics", "arcana", "athletics"])).toBe("Skills: choose 3");
    // One short of full still carries the tail, so the bound is `<`, not `<=`.
    expect(full(3, ["acrobatics", "arcana"])).toBe("Skills: choose 3 · 2 picked");
  });
});

// ── R4-G5 §3 · the pool-synth item: long-list routing, the visibility filter, the stranded dress ──
// The item shape is the one `buildDecisionLedger`'s pool synth emits (research A-02, replayed as DOM
// by A-12): a `select-entity optional-feature` carrying `from`, plus T2's `pool` marker. A-12 measured
// TODAY's behaviour on it: 43 options render 43 chips, no ghost, no tlabel.
describe("renderDecisionStrip · the `from` pool-synth arm (R4-G5 §3.2.1-§3.2.3)", () => {
  const fromOpt = (slug: string, over: Partial<ResolvedOption> = {}): ResolvedOption =>
    ({ value: slug, label: slug, entity: registeredEntity(slug), ...over });

  const poolItem = (
    n: number,
    over: Partial<DecisionItem> = {},
    optOver: (i: number) => Partial<ResolvedOption> = () => ({}),
  ): DecisionItem =>
    item({
      key: "battle-master-maneuvers", source: { kind: "class" } as never, level: 3,
      featureName: "Maneuvers",
      choice: {
        kind: "select-entity", id: "battle-master-maneuvers", label: "Maneuvers", count: 3,
        entity_type: "optional-feature", from: Array.from({ length: n }, (_, i) => `mv-${i}`),
      } as never,
      options: Array.from({ length: n }, (_, i) => fromOpt(`mv-${i}`, optOver(i))),
      pool: { id: "battle-master-maneuvers", anchorLevel: 3 },
      selected: undefined, status: "unresolved",
      ...over,
    } as Partial<DecisionItem>);

  const hidingCtx = (editState: Record<string, unknown>, ...hiddenCompendiums: string[]): ComponentRenderContext =>
    ({
      resolved: { definition: {} }, derived: {},
      services: { entities: {}, plugin: { settings: { hiddenCompendiums } } },
      editState, builderUiState: new Map(),
    }) as unknown as ComponentRenderContext;

  const draw = (it_: DecisionItem, ctx: ComponentRenderContext): HTMLElement => {
    const c = mountContainer();
    renderDecisionStrip(c, ctx, { items: [it_], pill: (i) => `L${i.level}`, live: true, classIndex: 0, stateKey: "t" });
    return c;
  };
  const chipValues = (c: HTMLElement): (string | null)[] =>
    Array.from(c.querySelectorAll(".pc-bchoice-chip")).map((n) => n.getAttribute("data-prof"));

  it("RED FIRST (row 1): a 13-option `from` item renders the 'Browse all 13' ghost, not 13 chips", () => {
    const c = draw(poolItem(13), mkCtx({ setChoice: vi.fn() }));
    expect((c.querySelector(".pc-dstrip-browse") as HTMLElement | null)?.textContent).toContain("Browse all 13");
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
    // The `from` arm emits NO caps header: the chips row never had one and the route does not add one
    // (the `!from` arm's own `.pc-dstrip-tlabel` is untouched, and A-12's control asserts it there).
    expect(c.querySelectorAll(".pc-dstrip-tlabel").length).toBe(0);
  });

  it("row 2: a 12-option `from` item KEEPS its 12 chips and grows no ghost (the boundary)", () => {
    const c = draw(poolItem(12), mkCtx({ setChoice: vi.fn() }));
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(12);
    expect(c.querySelector(".pc-dstrip-browse")).toBeNull();
  });

  it("RED FIRST (row 3): a hidden-compendium `from` option loses its chip; a hidden SELECTED one keeps it", () => {
    // mv-1 and mv-2 sit in the hidden compendium; mv-2 is the current pick, so the exemption keeps it.
    const it_ = poolItem(3, { selected: ["mv-2"], status: "partial" }, (i) =>
      i === 0 ? {} : { entity: { ...registeredEntity(`mv-${i}`), compendium: "SRD 5e" } as never });
    const values = chipValues(draw(it_, hidingCtx({ setChoice: vi.fn() }, "SRD 5e")));
    expect(values).not.toContain("mv-1");   // hidden, unselected: filtered
    expect(values).toContain("mv-2");       // hidden BUT selected: exempt
    expect(values).toContain("mv-0");       // visible
  });

  it("RED FIRST: a `stranded` option wears the prerequisite-unmet dress in the CHIPS arm", () => {
    const it_ = poolItem(3, { selected: ["mv-2"], status: "partial" }, (i) => (i === 2 ? { stranded: true } : {}));
    const c = draw(it_, mkCtx({ setChoice: vi.fn() }));
    const chip = Array.from(c.querySelectorAll<HTMLElement>(".pc-bchoice-chip"))
      .find((n) => n.getAttribute("data-prof") === "mv-2")!;
    expect(chip.getAttribute("data-stranded")).toBe("true");
    expect(chip.textContent).toContain("(prerequisite unmet)");
    expect(chip.getAttribute("title")).toBe(STRANDED_TIP);
    // The crimson IS `.sel`'s shipped dress: a stranded option is by construction a SELECTED one, so
    // the task adds no CSS (spec §8 books three selectors, none in builder.css).
    expect(chip.classList.contains("sel")).toBe(true);
    // a non-stranded sibling carries neither the hook nor the wording (the assertion is not vacuous)
    const plain = Array.from(c.querySelectorAll<HTMLElement>(".pc-bchoice-chip"))
      .find((n) => n.getAttribute("data-prof") === "mv-0")!;
    expect(plain.getAttribute("data-stranded")).toBeNull();
  });

  it("RED FIRST (row 5): a stranded SELECTION CHIP wears the dress beside the 'Change' ghost in the long-list arm", () => {
    const it_ = poolItem(14, { selected: ["mv-13"], status: "partial" }, (i) => (i === 13 ? { stranded: true } : {}));
    const c = draw(it_, mkCtx({ setChoice: vi.fn() }));
    const chip = c.querySelector<HTMLElement>(".pc-bchoice-chip.sel")!;
    expect(chip.getAttribute("data-stranded")).toBe("true");
    expect(chip.textContent).toContain("(prerequisite unmet)");
    expect((c.querySelector(".pc-dstrip-browse") as HTMLElement).textContent).toContain("Change");
  });

  it("RED FIRST (row 11): a POOL item at count 1 writes an ARRAY; a non-pool `from` item writes a string", () => {
    const setChoice = vi.fn();
    const one = poolItem(4);
    (one.choice as { count: number }).count = 1;   // `poolItem` already stamps the `pool` marker
    const c = draw(one, mkCtx({ setChoice }));
    c.querySelectorAll<HTMLElement>(".pc-bchoice-chip")[0].click();
    expect(setChoice).toHaveBeenCalledWith(0, 3, "battle-master-maneuvers", ["mv-0"]);
    // The control: a `feat` pick keeps the STRING shape dnd5e `collectFeatPicks` reads (`typeof feat === "string"`).
    const setChoice2 = vi.fn();
    const feat = item({
      key: "feat", source: { kind: "class" } as never, level: 19, featureName: "Epic Boon",
      choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat", from: ["boon-of-fate"] } as never,
      options: [fromOpt("boon-of-fate")], selected: undefined, status: "unresolved",
    });
    const c2 = draw(feat, mkCtx({ setChoice: setChoice2 }));
    c2.querySelectorAll<HTMLElement>(".pc-bchoice-chip")[0].click();
    expect(setChoice2).toHaveBeenCalledWith(0, 19, "feat", "boon-of-fate");
  });

  it("the ORDER is filter-then-count: 13 options, one hidden, stays on the CHIPS row (fixture-only)", () => {
    // 13 `from` options, exactly ONE of them in the hidden compendium and none selected. The
    // route counts VISIBLE resolved candidates, so 12 survive the filter and the item stays
    // below the threshold. Counting BEFORE filtering would route it and lose the chips wall.
    // t3-m3 kills the predicate but not its PLACEMENT, which is what this case pins.
    const it_ = poolItem(13, {}, (i) =>
      i === 12 ? { entity: { ...registeredEntity("mv-12"), compendium: "SRD 5e" } as never } : {});
    const c = draw(it_, hidingCtx({ setChoice: vi.fn() }, "SRD 5e"));
    expect(c.querySelector(".pc-dstrip-browse")).toBeNull();
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(12);
    expect(chipValues(c)).not.toContain("mv-12");
  });

  it("the filter can empty a `from` arm, and the copy says so (fixture-only: shipped data removes nothing)", () => {
    const it_ = poolItem(2, {}, (i) => ({ entity: { ...registeredEntity(`mv-${i}`), compendium: "SRD 5e" } as never }));
    const c = draw(it_, hidingCtx({ setChoice: vi.fn() }, "SRD 5e"));
    expect(c.querySelector(".pc-dstrip-empty")!.textContent)
      .toBe("No options available. Some exist in a hidden compendium (see Archivist settings).");
  });
});
