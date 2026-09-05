/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PoolTab } from "../packages/obsidian/src/modules/pc/components/pool-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { __resetWarnOnceForTests } from "@archivist-gg/dnd5e/dnd/warn-once";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool } from "@archivist-gg/dnd5e/pc/pc.types";

/** The `spend control:` warnings this file's fixture provokes, captured instead of printed. */
const swallowedSpendWarns: string[] = [];

beforeAll(() => {
  installObsidianDomHelpers();
  // `basePool`'s baleful-glare consumes "seals" and `mkCtx` seeds no `feature_uses`, so every
  // render of it is an unowned spender and `renderSpendControl` emits its one `warnOnce`
  // (R4-G4 §13, the designed behaviour). Swallow ONLY that message, so the suite's output stays
  // clean under a reporter that shows console output for passing tests (vitest's default reporter
  // hides it, `--disable-console-intercept` does not) while any OTHER warning from this file, the
  // seed's `resource-seed:` warns included, still reaches the console. The captured messages are
  // asserted below, so the filter costs no kill power.
  const realWarn = console.warn.bind(console);
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.startsWith("spend control:")) { swallowedSpendWarns.push(first); return; }
    realWarn(...args);
  });
});

afterAll(() => vi.restoreAllMocks());

function ofEntity(slug: string, extra: Record<string, unknown> = {}) {
  return {
    slug, name: slug, edition: "2014", source: "hb", feature_type: "interdict-boon",
    description: "desc-" + slug, effects: [], prerequisites: [{ kind: "level", min: 2 }], available_to: [], ...extra,
  };
}

type EditStub = Partial<{
  setChoice: (...a: unknown[]) => void;
  toggleActiveBuff: (slug: string) => void;
}>;

function mkCtx(pool: ResolvedPool, editState: EditStub = {}, activeBuffs: string[] = []): ComponentRenderContext {
  return {
    resolved: { pools: [pool], state: { active_buffs: activeBuffs } } as unknown as ResolvedCharacter,
    derived: {} as never, services: {} as never, app: {} as never,
    editState: editState as never,
  };
}

/** `mkCtx` plus the ownership of "seals": the seeded `feature_uses` key AND the index entry the
 *  Cost label and the spend control read (R4-G4 §3.2.2 / §3.2.4). */
function ownedCtx(pool: ResolvedPool): ComponentRenderContext {
  const ctx = mkCtx(pool);
  (ctx.resolved.state as { feature_uses?: unknown }).feature_uses = { seals: { used: 0, max: 3 } };
  (ctx.resolved as { resources?: unknown }).resources = new Map([["seals", { id: "seals", name: "Seals", reset: "long-rest", maxFormula: "3", owner: { kind: "feature", featureId: "s", featureName: "Seals", source: { kind: "class", slug: "reaver", level: 1 } } }]]);
  return ctx;
}

const basePool: ResolvedPool = {
  id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 2,
  selected: [{ slug: "baleful-glare", entity: ofEntity("baleful-glare", { action_cost: "action", consumes: { resource: "seals", amount: 1 } }) as never }],
  available: [
    { slug: "baleful-glare", entity: ofEntity("baleful-glare", { action_cost: "action", consumes: { resource: "seals", amount: 1 } }) as never },
    { slug: "hell-mage", entity: ofEntity("hell-mage") as never },
  ],
  grants: [{ slug: "axiomatic-seals", entity: ofEntity("axiomatic-seals", { passive: true }) as never }],
};

describe("PoolTab — spell-like", () => {
  it("renders a 'Known X / N' counter", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-spell-counts")?.textContent).toContain("1 / 2");
  });

  it("groups candidates into a level band and renders a row per available boon", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-actions-section-head")?.textContent).toContain("Level 2");
    // 2 available + 1 granted = 3 rows
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(3);
    expect(el.textContent).toContain("baleful-glare");
    expect(el.textContent).toContain("hell-mage");
  });

  it("checks the toggle box of an already-selected boon and leaves others unchecked", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const checked = el.querySelectorAll(".archivist-toggle-box.archivist-toggle-box-checked");
    expect(checked.length).toBe(1); // only baleful-glare (the grant has no toggle box)
  });

  it("clicking an unselected boon's box appends it to the ledger", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool, { setChoice }));
    // hell-mage row is the 2nd available; find its box (not checked)
    const boxes = el.querySelectorAll<HTMLElement>(".pc-spell-list .archivist-toggle-box");
    const unchecked = [...boxes].find((b) => !b.classList.contains("archivist-toggle-box-checked"))!;
    unchecked.click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", ["baleful-glare", "hell-mage"]);
  });

  it("clicking a selected boon's box removes it from the ledger", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool, { setChoice }));
    const checked = el.querySelector<HTMLElement>(".archivist-toggle-box.archivist-toggle-box-checked")!;
    checked.click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", []);
  });

  it("at cap, unselected boxes are locked and do not write", () => {
    const setChoice = vi.fn();
    const fullPool: ResolvedPool = {
      ...basePool, count: 1,
      selected: [{ slug: "baleful-glare", entity: ofEntity("baleful-glare") as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(fullPool, { setChoice }));
    const locked = el.querySelector<HTMLElement>(".archivist-toggle-box.pc-box-locked")!;
    expect(locked).not.toBeNull();
    locked.click();
    expect(setChoice).not.toHaveBeenCalled();
  });

  it("shows the consume cost in the row's meta sub-line", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    // R4-G4: the raw id when the character owns no such resource; the singularized
    // "Seal" was renderer-side game vocabulary (invariant 3). The owned half of this
    // read is pinned by the spend-control test below.
    expect(el.textContent).toContain("1 seals");
  });

  it("R4-G4 §3: a row whose consumes.resource is OWNED renders the spend control; an unowned one renders none", () => {
    const ctx = ownedCtx({ ...basePool });
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, ctx);
    expect(el.querySelector("button.pc-spend-control")!.textContent).toBe("Spend 1 Seals");
    // The OTHER half of the same index read: the Cost meta prints the index NAME, not the raw id.
    expect(el.querySelector(".pc-spell-sub")!.textContent).toContain("1 Seals");
    const el2 = mountContainer();
    new PoolTab("interdict-boons").render(el2, mkCtx(basePool));
    expect(el2.querySelector("button.pc-spend-control")).toBeNull();
  });

  it("R4-G4 §3.2.4: an UNSELECTED available row carries NO spend control, an owned selected one does", () => {
    // The control is offered on KNOWN entries only: a maneuver the character has not picked is not
    // spendable, so the button belongs to the selected row and to the granted row below, never to a
    // bare candidate. (`renderBoonRow` is reached only with kind "selected" or "granted", so the
    // Actions / Passive boon surface already had this property.)
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, ownedCtx({ ...basePool, selected: [] }));
    expect(el.querySelector("button.pc-spend-control")).toBeNull();
  });

  it("R4-G4 §3.2.4: a GRANTED consuming entry carries the spend control", () => {
    // `available` and `selected` are emptied so the ONLY consuming row on the tab is the granted
    // one: with baleful-glare still available, a tab-wide query would find ITS button and pass
    // vacuously.
    const granted = { ...basePool, selected: [], available: [], grants: [
      { slug: "axiomatic-seals", entity: ofEntity("axiomatic-seals", { consumes: { resource: "seals", amount: 1 } }) as never },
    ] };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, ownedCtx(granted));
    const row = Array.from(el.querySelectorAll<HTMLElement>(".pc-spell-prep-row")).find((r) => r.querySelector(".pc-spell-always"))!;
    expect(row.querySelector("button.pc-spend-control")!.textContent).toBe("Spend 1 Seals");
  });

  it("R4-G4 §13: an UNOWNED consuming row renders no control and warns exactly once for that id", () => {
    __resetWarnOnceForTests();
    swallowedSpendWarns.length = 0;
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(swallowedSpendWarns).toEqual([
      'spend control: "seals" is not an owned resource (cross-book or dangling); no control rendered',
    ]);
    expect(el.querySelector("button.pc-spend-control")).toBeNull();
  });

  it("clicking a name expands a plain-text description", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const nameWrap = el.querySelector<HTMLElement>(".pc-spell-namewrap")!;
    nameWrap.click();
    expect(el.querySelector(".pc-spell-expand")?.textContent).toContain("desc-");
  });

  it("renders a granted row tagged 'granted' with no toggle box", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const grantHead = [...el.querySelectorAll(".pc-actions-section-head")].find((h) => h.textContent?.includes("Granted"));
    expect(grantHead).toBeTruthy();
    expect(el.querySelector(".pc-spell-always")?.textContent).toMatch(/granted/i);
  });

  it("marks the counter .over when selections exceed the cap", () => {
    const overPool: ResolvedPool = {
      ...basePool, count: 1,
      selected: [
        { slug: "a", entity: ofEntity("a") as never },
        { slug: "b", entity: ofEntity("b") as never },
      ],
      available: [], grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(overPool));
    expect(el.querySelector(".pc-spell-counts b.over")).not.toBeNull();
  });

  it("renders an inline Active control on a selected activatable boon and toggles it", () => {
    const toggleActiveBuff = vi.fn();
    const actPool: ResolvedPool = {
      ...basePool, count: 2,
      selected: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      available: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(actPool, { toggleActiveBuff }));
    const actv = el.querySelector<HTMLButtonElement>(".pc-pool-active")!;
    expect(actv.textContent).toBe("Activate");
    actv.click();
    expect(toggleActiveBuff).toHaveBeenCalledWith("majesty");
  });

  it("shows an active boon in the active-effects rail", () => {
    const actPool: ResolvedPool = {
      ...basePool, count: 2,
      selected: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      available: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(actPool, {}, ["majesty"]));
    expect(el.querySelector(".pc-ae-tile .pc-ae-name")?.textContent).toBe("majesty");
  });

  it("renders an empty-state when the pool id is unknown", () => {
    const el = mountContainer();
    new PoolTab("nope").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-empty-line")).not.toBeNull();
  });

  it("has no reaver/boon literals leaking into rendered text beyond the data", () => {
    // genericity smoke: the component must not invent labels; it only echoes data.
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.textContent).not.toContain("Interdict Boons"); // pool.label is NOT shown as a heading anymore
  });
});

describe("PoolTab — blocks layout", () => {
  it("renders each available boon as a pc-block card with title, meta and description", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el, mkCtx(basePool));
    const cards = el.querySelectorAll(".pc-block.pc-boon-block");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(el.querySelector(".pc-boon-block .pc-block-title")?.textContent).toBeTruthy();
    expect(el.querySelector(".pc-boon-block .pc-block-meta")).not.toBeNull();
    expect(el.querySelector(".pc-boon-block .pc-block-description")?.textContent).toContain("desc-");
  });

  it("blocks layout keeps the toggle box and the active-effects rail", () => {
    const actPool: ResolvedPool = {
      ...basePool, count: 2,
      selected: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      available: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el, mkCtx(actPool, {}, ["majesty"]));
    expect(el.querySelector(".pc-boon-block .archivist-toggle-box")).not.toBeNull();
    expect(el.querySelector(".pc-ae-tile .pc-ae-name")?.textContent).toBe("majesty");
  });
});

describe("PoolTab — stranded selected picks (prereq now unmet)", () => {
  // a pool whose only selection is NOT in `available` (its prereq is unmet)
  const strandedPool: ResolvedPool = {
    ...basePool, count: 2,
    selected: [{ slug: "lofty-boon", entity: ofEntity("lofty-boon", { prerequisites: [{ kind: "level", min: 20 }] }) as never }],
    available: [{ slug: "hell-mage", entity: ofEntity("hell-mage") as never }],
    grants: [],
  };

  it("spell-like: renders stranded picks in a 'prerequisite unmet' band", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(strandedPool));
    const head = [...el.querySelectorAll(".pc-actions-section-head")].find((h) => h.textContent?.toLowerCase().includes("prerequisite"));
    expect(head).toBeTruthy();
    expect(el.textContent).toContain("lofty-boon");
    // the counter stays honest: the stranded pick still counts toward Known X / N
    expect(el.querySelector(".pc-spell-counts")?.textContent).toContain("1 / 2");
  });

  it("spell-like: the stranded row's box is checked and clicking it removes the pick", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(strandedPool, { setChoice }));
    const checked = el.querySelectorAll<HTMLElement>(".archivist-toggle-box.archivist-toggle-box-checked");
    expect(checked.length).toBe(1); // only the stranded selected pick
    checked[0].click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", []);
  });

  it("blocks: renders a stranded pick as a removable card", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el, mkCtx(strandedPool, { setChoice }));
    expect(el.textContent).toContain("lofty-boon");
    const box = el.querySelector<HTMLElement>(".pc-boon-block .archivist-toggle-box.archivist-toggle-box-checked");
    expect(box).not.toBeNull();
    box!.click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", []);
  });

  it("does not render a stranded band when every selected pick is in available", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool)); // baleful-glare is selected AND available
    const head = [...el.querySelectorAll(".pc-actions-section-head")].find((h) => h.textContent?.toLowerCase().includes("prerequisite"));
    expect(head).toBeUndefined();
  });

  it("renders available rows AND a stranded band together (a selection in available + one not)", () => {
    // hell-mage is selected AND available; lofty-boon is selected but prereq-unmet (stranded)
    const mixedPool: ResolvedPool = {
      ...basePool, count: 3,
      selected: [
        { slug: "hell-mage", entity: ofEntity("hell-mage") as never },
        { slug: "lofty-boon", entity: ofEntity("lofty-boon", { prerequisites: [{ kind: "level", min: 20 }] }) as never },
      ],
      available: [{ slug: "hell-mage", entity: ofEntity("hell-mage") as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(mixedPool));
    // both the available row and the stranded row are present...
    expect(el.textContent).toContain("hell-mage");
    expect(el.textContent).toContain("lofty-boon");
    // ...as two distinct bands (a level band for the available pick + the prerequisite-unmet band)
    const heads = [...el.querySelectorAll(".pc-actions-section-head")].map((h) => h.textContent ?? "");
    expect(heads.some((t) => t.includes("Level 2"))).toBe(true);
    expect(heads.some((t) => t.toLowerCase().includes("prerequisite"))).toBe(true);
    // both selected picks are checked + removable; counter counts both
    expect(el.querySelectorAll(".archivist-toggle-box.archivist-toggle-box-checked").length).toBe(2);
    expect(el.querySelector(".pc-spell-counts")?.textContent).toContain("2 / 3");
  });
});

describe("PoolTab — D1 pool-desc expand persistence", () => {
  // The suite has no `mkPool`/`layout` builders (the brief's assumed names); it
  // uses the `basePool` const + `mkCtx(pool)` + the default spell-like layout, so
  // this keeps the SHAPE (click `.pc-spell-namewrap`, shared `bag`, re-render,
  // assert `.pc-spell-expand` re-appears) and adapts to those actual helpers.
  it("re-creates an open boon description across a re-render with the same bag", () => {
    const bag = new Map<string, unknown>();
    const root1 = mountContainer();
    new PoolTab("interdict-boons").render(root1, { ...mkCtx(basePool), builderUiState: bag } as never);
    const name1 = root1.querySelector(".pc-spell-prep-row .pc-spell-namewrap") as HTMLElement;
    name1.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root1.querySelector(".pc-spell-prep-row-host .pc-spell-expand")).not.toBeNull();

    const root2 = mountContainer();
    new PoolTab("interdict-boons").render(root2, { ...mkCtx(basePool), builderUiState: bag } as never);
    expect(root2.querySelector(".pc-spell-prep-row-host .pc-spell-expand")).not.toBeNull();
  });
});
