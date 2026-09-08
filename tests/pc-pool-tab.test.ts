/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PoolTab } from "../packages/obsidian/src/modules/pc/components/pool-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { __resetWarnOnceForTests } from "@archivist-gg/dnd5e/dnd/warn-once";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { CUSTOM_RESET_TIP } from "../packages/obsidian/src/modules/pc/components/actions/reset-labels";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool } from "@archivist-gg/dnd5e/pc/pc.types";
import { EntityRegistry } from "@core/entity-registry";

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
    resolved: { pools: [pool], classes: [], state: { active_buffs: activeBuffs } } as unknown as ResolvedCharacter,
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
    // R4-G4: the raw id when the character owns no such resource AND no registry entity declares one;
    // the singularized "Seal" was renderer-side game vocabulary (invariant 3). The owned half of this
    // read is pinned by the spend-control test below, and the DECLARED half by the rider's own test.
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.textContent).toContain("1 seals");
  });

  // R4 {G5, G6} live rider V-5. Twelve rows on the live sheets printed a raw resource id as their
  // subtitle (`1 fighter-2024:superiority-dice`, `1 fighter:arcane-shot-uses`) where their siblings
  // read `1 Superiority Dice`: a cross-edition pick consumes a resource its owner does not own, so the
  // `resolved.resources` index misses and the id fell through. The NAME is in the vault all the same:
  // the class that declares the resource carries it. This is a data lookup, not vocabulary logic ·
  // nothing here singularizes, capitalizes or knows a game word.
  it("prints the NAME a registry entity declares for a resource the character does not own", () => {
    const reg = new EntityRegistry();
    reg.register({
      slug: "phb-2024_class_fighter", name: "Fighter", entityType: "class",
      filePath: "Player's Handbook (2024)/Classes/Fighter.md", compendium: "Player's Handbook (2024)",
      readonly: true, homebrew: false,
      data: {
        resources: [],
        features_by_level: {
          3: [{
            id: "combat-superiority", name: "Combat Superiority",
            resources: [{
              id: "fighter-2024:superiority-dice", name: "Superiority Dice",
              max_formula: "4", reset: "short-rest", die: { base: "d8" },
            }],
          }],
        },
      },
    });
    const pool: ResolvedPool = {
      ...basePool,
      selected: [{ slug: "ambush", entity: ofEntity("ambush", { consumes: { resource: "fighter-2024:superiority-dice", amount: 1 } }) as never }],
      available: [
        { slug: "ambush", entity: ofEntity("ambush", { consumes: { resource: "fighter-2024:superiority-dice", amount: 1 } }) as never },
        { slug: "unheard-of", entity: ofEntity("unheard-of", { consumes: { resource: "homebrew:nobody-declares-this", amount: 2 } }) as never },
      ],
      grants: [],
    };
    const ctx = mkCtx(pool);
    (ctx as { services: unknown }).services = { entities: reg } as never;
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, ctx);
    const subs = [...el.querySelectorAll(".pc-spell-sub")].map((n) => n.textContent);
    // The `Passive · ` prefix is the N-1-7 rider's: neither fixture entity declares an action cost, so
    // both rows name the bucket they file under before their cost.
    expect(subs).toContain("Passive · 1 Superiority Dice");
    expect(subs.join(" | ")).not.toContain("fighter-2024:superiority-dice");
    // The negative: an id NO entity declares keeps the raw string, so nothing is invented.
    expect(subs).toContain("Passive · 2 homebrew:nobody-declares-this");
  });

  // R4 {G5, G6} live rider N-1-7: in the fighting-style pool `Great Weapon Fighting` alone had NO
  // economy sub-line while its siblings read `Passive`, `Reaction`, `Passive · Special`. An entry that
  // declares no action economy still FILES under Passive & Free Actions (`featureEconomy(undefined)`),
  // so the row says the bucket it is in instead of saying nothing.
  it("an entry with no action economy reads Passive in its meta sub-line", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const rows = [...el.querySelectorAll(".pc-spell-prep-row")];
    const hellMage = rows.find((r) => r.querySelector(".pc-spell-name")?.textContent === "hell-mage")!;
    expect(hellMage.querySelector(".pc-spell-sub")?.textContent).toBe("Passive");
    // The control: a row that DOES declare a cost keeps its own reading, with no Passive prepended.
    const baleful = rows.find((r) => r.querySelector(".pc-spell-name")?.textContent === "baleful-glare")!;
    expect(baleful.querySelector(".pc-spell-sub")?.textContent).toBe("1 Action · 1 seals");
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

  it("R4-G4 §3.2.4: the blocks layout withholds the control from an UNPICKED candidate and keeps it on a picked one", () => {
    // The known-entries rule is a property of the CONTROL, not of a layout: `blockCard` renders the
    // available candidates as well as the picks, so it needs the same gate `row()` carries.
    const el = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el, ownedCtx({ ...basePool, selected: [], grants: [] }));
    expect(el.querySelector("button.pc-spend-control")).toBeNull();
    const el2 = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el2, ownedCtx(basePool));
    expect(el2.querySelector("button.pc-spend-control")!.textContent).toBe("Spend 1 Seals");
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

  it("R4-G5 §4.2.2 (a): a block card carries the ally caption and NO tracker (a presence assertion, no mutant row)", () => {
    // Spec §4.5 and §13's "Named NON-mutants" line both name this case. It carries NO MUTANT, but it IS a
    // test and it RUNS (Gate 2 I3: filing it under "run nothing" conflated "carries no mutant" with
    // "carries no test"). It guards the two halves of Step B7 (d): `blockCard` GAINS the caption and gains
    // NO tracker. BOTH halves are non-vacuous by construction:
    //   * the caption half needs a die, and the shipped `ownedCtx` "seals" entry declares none
    //     (`renderAffordanceCaption` returns early without one), so the case gives it `die: { base: "d8" }`;
    //   * the tracker half needs an entry that WOULD draw one, so the case seeds `feature_uses["cs-block"]`
    //     AND its own index entry, exactly what `renderPickTracker` reads. It draws none because
    //     `blockCard` never calls it.
    // `classes` here carries the owning class for `renderAffordanceCaption`, which reaches
    // `resourceLevelFor`, and that does `resolved.classes.find(...)` UNGUARDED (measured: it matches a
    // `kind: "class"` source on `c.entity?.slug` and never reads `subclass`). `mkCtx` now casts
    // `classes: []` (T7); this local, subclass-less entry predates it and is kept as the case's own
    // witness that `poolSaveDC` returns null here.
    const csEntry = { slug: "cs-block", entity: ofEntity("cs-block", {
      rendering_hint: "granted-die-to-ally", uses: { max: 1, recharge: "short-rest" },
      consumes: { resource: "seals", amount: 1 },
    }) as never };
    const p = { ...basePool, selected: [csEntry], available: [csEntry], grants: [] } as unknown as ResolvedPool;
    const c = ownedCtx(p);
    (c.resolved as { classes?: unknown }).classes = [{ entity: { slug: "reaver" }, level: 2 }];
    (c.resolved.state.feature_uses as Record<string, object>)["cs-block"] = { used: 0, max: 1 };
    // No cast: `ResourceIndex` is a ReadonlyMap, so `.get(...)` needs none and the shipped
    // `as Map<string, object>` spelling is only ever for `.set`. A `Map<string, { die?: unknown }>`
    // assertion here is a TS2352 (`unknown` does not overlap `ResourceDie`), which the per-file tsc
    // instrument reads as a NEW error line.
    c.resolved.resources.get("seals")!.die = { base: "d8" };
    (c.resolved.resources as Map<string, object>).set("cs-block", pickRes("cs-block", "short-rest"));
    const el = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el, c);
    const card = el.querySelector<HTMLElement>(".pc-boon-block")!;
    expect(card.querySelector(".pc-affordance-caption")!.textContent).toBe("1d8 to an ally");
    expect(card.querySelector(".pc-pick-track")).toBeNull();
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

/** `mkCtx` plus everything a pool tab head reads, on any layout (R4-G4 §4.3's contract,
 *  confirmation r6 M-1): the pool's OWNED resource id, its seeded `feature_uses` entry, the
 *  `resolved.resources` index entry carrying `owner` and `die`, AND `resolved.classes` with the owning
 *  class, because `resourceLevelFor` walks `resolved.classes` and `poolSaveDC` indexes
 *  `classes[pool.classIndex]`: both THROW on an absent array; `mkCtx` now casts an EMPTY `classes` (T7),
 *  which this builder replaces with the owning class.
 *  `derived` carries the two fields `poolSaveDC` reads. */
const withOwner = (pool: ResolvedPool, fu: { used: number; max: number }, res: object): ComponentRenderContext => {
  const c = mkCtx(pool);
  (c.resolved.state as { feature_uses?: unknown }).feature_uses = { [pool.resource!]: fu };
  (c.resolved as { resources?: unknown }).resources = new Map([[pool.resource!, res]]);
  (c.resolved as { classes?: unknown }).classes = [{ entity: { slug: "fighter" }, level: 3, subclass: { slug: "bm" } }];
  (c as { derived: unknown }).derived = { proficiencyBonus: 2, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 0 } };
  return c;
};

const dice = {
  id: "fighter-2024:superiority-dice", name: "Superiority Dice", reset: "short-rest", maxFormula: "4",
  die: { base: "d8" },
  owner: { kind: "feature", featureId: "cs", featureName: "Combat Superiority", source: { kind: "subclass", slug: "bm", level: 3 } },
};

/** Every element inside the head whose FULL text is the resource name. Only the leaf name spans can
 *  match (an ancestor's text is always longer), so the count IS the number of times the head prints
 *  the name: 1 is right, 2 is the doubled name of review I-2. */
const nameSpans = (head: Element, name: string) =>
  Array.from(head.querySelectorAll("*")).filter((e) => e.textContent === name);

describe("PoolTab · dice-pool / point-pool heads (R4-G4 §4.2.6)", () => {
  it("RED FIRST: dice-pool renders 4 d8 boxes in the tab head", () => {
    const el = mountContainer();
    const c = withOwner({ ...basePool, layout: "dice-pool", resource: "fighter-2024:superiority-dice" }, { used: 1, max: 4 }, dice);
    new PoolTab("interdict-boons", "dice-pool").render(el, c);
    const head = el.querySelector(".pc-pool-head")!;
    expect(head.querySelectorAll(".archivist-toggle-box").length).toBe(4);
    expect(head.querySelector(".pc-resource-die")!.textContent).toBe("d8");
    expect(head.querySelector(".pc-pool-head-name")!.textContent).toBe("Superiority Dice");
    expect(head.querySelector(".pc-charge-recovery")!.textContent).toBe("/ Short Rest");
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(3);   // the spell-like list still renders
  });

  it("RED FIRST: point-pool renders the numeric widget in the tab head", () => {
    const el = mountContainer();
    const points = { ...dice, id: "sorcerer:sorcery-points", name: "Sorcery Points", die: undefined };
    const c = withOwner({ ...basePool, layout: "point-pool", resource: "sorcerer:sorcery-points" }, { used: 1, max: 3 }, points);
    new PoolTab("interdict-boons", "point-pool").render(el, c);
    expect(el.querySelector(".pc-pool-head .pc-point-pool-value")!.textContent).toBe("2 / 3");
    expect(el.querySelector(".pc-pool-head .pc-resource-die")).toBeNull();
  });

  it("RED FIRST: the dice head's box click writes setFeatureUse for the pool's OWNED id", () => {
    const setFeatureUse = vi.fn();
    const el = mountContainer();
    const c = withOwner({ ...basePool, layout: "dice-pool", resource: "fighter-2024:superiority-dice" }, { used: 1, max: 4 }, dice);
    (c as { editState: unknown }).editState = { setFeatureUse };
    new PoolTab("interdict-boons", "dice-pool").render(el, c);
    const boxes = el.querySelectorAll<HTMLElement>(".pc-pool-head .archivist-toggle-box");
    boxes[2].click();
    expect(setFeatureUse).toHaveBeenCalledWith("fighter-2024:superiority-dice", 3);
  });

  it("a hinted layout with NO owned resource renders the list and no head widget (Four Elements)", () => {
    const el = mountContainer();
    const c = mkCtx({ ...basePool, layout: "point-pool" });
    // §4.3's contract, the classes half: `poolSaveDC` indexes `resolved.classes[pool.classIndex]`
    // (Gate 2 I-8). `mkCtx` now casts `classes: []`, so this local assignment is redundant, kept as the
    // case's own witness.
    (c.resolved as { classes?: unknown }).classes = [];
    new PoolTab("interdict-boons", "point-pool").render(el, c);
    // Neither a DC nor an owned resource, so the head is never created: no empty spacer div carrying
    // the `.pc-pool-head` margin (review M-3).
    expect(el.querySelector(".pc-pool-head")).toBeNull();
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(3);
  });

  it("an UNKNOWN layout string renders spell-like and does not throw", () => {
    const el = mountContainer();
    expect(() => new PoolTab("interdict-boons", "nope" as never).render(el, mkCtx(basePool))).not.toThrow();
    expect(el.querySelector(".pc-spell-counts")).not.toBeNull();
  });

  it("RED FIRST (§11): the head prints '<label> save DC 13' for a no-caster subclass carrying spellcasting.ability", () => {
    const el = mountContainer();
    const c = mkCtx({ ...basePool, layout: "point-pool" });
    (c as { derived: unknown }).derived = { proficiencyBonus: 2, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 0 } };
    (c.resolved as { classes: unknown }).classes = [{ entity: { slug: "monk" }, level: 6, subclass: { slug: "fe", spellcasting: { ability: "wis" } } }];
    new PoolTab("interdict-boons", "point-pool").render(el, c);
    expect(el.querySelector(".pc-pool-dc")!.textContent).toBe("Interdict Boons save DC 13");
  });

  it("§11: a pool whose owning class has no subclass save ability prints NO DC line", () => {
    const el = mountContainer();
    const c = withOwner({ ...basePool, layout: "dice-pool", resource: "fighter-2024:superiority-dice" }, { used: 1, max: 4 }, dice);
    new PoolTab("interdict-boons", "dice-pool").render(el, c);
    expect(el.querySelector(".pc-pool-dc")).toBeNull();
  });

  // Review I-2: the head owns a name span AND `renderPointPool` writes its own, so wherever the
  // numeric widget runs the head printed the name twice. The head keeps its span exactly where the
  // widget does NOT run. The widget runs on the points shape, and on the dice shape when the boxes
  // hand off to `renderLarge`, which is `max > CHARGE_BOX_LIMIT` AND not at will.
  it("RED FIRST (I-2): the point-pool head prints the resource name ONCE", () => {
    const el = mountContainer();
    const points = { ...dice, id: "sorcerer:sorcery-points", name: "Sorcery Points", die: undefined };
    const c = withOwner({ ...basePool, layout: "point-pool", resource: "sorcerer:sorcery-points" }, { used: 1, max: 3 }, points);
    new PoolTab("interdict-boons", "point-pool").render(el, c);
    const head = el.querySelector(".pc-pool-head")!;
    expect(nameSpans(head, "Sorcery Points").length).toBe(1);
    expect(head.querySelector(".pc-point-pool-name")!.textContent).toBe("Sorcery Points");
    expect(head.querySelector(".pc-pool-head-name")).toBeNull();
  });

  it("RED FIRST (I-2): a dice head ABOVE CHARGE_BOX_LIMIT renders the numeric widget and prints the name ONCE", () => {
    const el = mountContainer();
    const c = withOwner({ ...basePool, layout: "dice-pool", resource: "fighter-2024:superiority-dice" }, { used: 2, max: 25 }, dice);
    new PoolTab("interdict-boons", "dice-pool").render(el, c);
    const head = el.querySelector(".pc-pool-head")!;
    expect(nameSpans(head, "Superiority Dice").length).toBe(1);
    expect(head.querySelector(".pc-point-pool-value")!.textContent).toBe("23 / 25");
    expect(head.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(head.querySelector(".pc-resource-die")!.textContent).toBe("d8");   // the die label is the head's, either way
  });

  it("an AT-WILL dice head keeps its own name span, because the numeric widget never runs there", () => {
    // `AT_WILL_MAX` is ABOVE `CHARGE_BOX_LIMIT`, but `renderChargeBoxes` returns on `atWill` BEFORE it
    // consults `renderLarge`, so no `renderPointPool` and therefore no second name. A guard written on
    // the max alone would drop the head's span here and leave this head nameless.
    const el = mountContainer();
    const c = withOwner({ ...basePool, layout: "dice-pool", resource: "fighter-2024:superiority-dice" }, { used: 0, max: AT_WILL_MAX }, dice);
    new PoolTab("interdict-boons", "dice-pool").render(el, c);
    const head = el.querySelector(".pc-pool-head")!;
    expect(nameSpans(head, "Superiority Dice").length).toBe(1);
    expect(head.querySelector(".pc-pool-head-name")!.textContent).toBe("Superiority Dice");
    expect(head.querySelector(".pc-charge-at-will")!.textContent).toBe("at will");
    expect(head.querySelector(".pc-point-pool")).toBeNull();
  });
});

/** A pool whose picks carry their OWN `uses` (R4-G4 §12): one selected, one granted. Neither
 *  `consumes` anything, so no spend control and no `spend control:` warn is in play in this block.
 *  Cloud Rune and Undying Servitude are real measured carriers (a TCE rune at `max: 1` /
 *  `short-rest`, a TCE invocation at `long-rest`); the max 2 here is the fixture's, for a two-box row. */
const usesPool: ResolvedPool = {
  ...basePool,
  selected: [{ slug: "tce_cloud-rune", entity: ofEntity("tce_cloud-rune", { uses: { max: 1, recharge: "short-rest" } }) as never }],
  available: [{ slug: "tce_cloud-rune", entity: ofEntity("tce_cloud-rune", { uses: { max: 1, recharge: "short-rest" } }) as never }],
  grants: [{ slug: "tce_undying-servitude", entity: ofEntity("tce_undying-servitude", { uses: { max: 2, recharge: "long-rest" } }) as never }],
};

const pickRes = (id: string, reset: string) => ({
  id, name: id, reset, maxFormula: "1",
  owner: { kind: "pool", poolId: "interdict-boons", poolLabel: "Interdict Boons", source: { kind: "class", slug: "reaver", level: 2 } },
});

/** `mkCtx` plus the TWO things `renderPickTracker` reads: the seeded `feature_uses` entry and the
 *  index entry the pool walk adds. `classes` is NOT needed here: the tracker reads the entry's
 *  `reset` and never calls `resourceLevelFor`. */
const pickCtx = (pool: ResolvedPool): ComponentRenderContext => {
  const c = mkCtx(pool);
  (c.resolved.state as { feature_uses?: unknown }).feature_uses = {
    "tce_cloud-rune": { used: 0, max: 1 },
    "tce_undying-servitude": { used: 1, max: 2 },
  };
  (c.resolved as { resources?: unknown }).resources = new Map([
    ["tce_cloud-rune", pickRes("tce_cloud-rune", "short-rest")],
    ["tce_undying-servitude", pickRes("tce_undying-servitude", "long-rest")],
  ]);
  return c;
};

const pickRow = (el: HTMLElement, granted: boolean) =>
  Array.from(el.querySelectorAll<HTMLElement>(".pc-spell-prep-row"))
    .find((r) => Boolean(r.querySelector(".pc-spell-always")) === granted)!;

describe("PoolTab · the picks' own uses (R4-G4 §12)", () => {
  it("RED FIRST: a selected pick with its own `uses` renders a 1-box tracker in its row", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, pickCtx(usesPool));
    const row = pickRow(el, false);
    expect(row.querySelectorAll(".pc-pick-track .archivist-toggle-box").length).toBe(1);
    expect(row.querySelector(".pc-pick-track .pc-charge-recovery")!.textContent).toBe("/ Short Rest");
    // none spent: the box is unchecked (and the row's own SELECT box is outside `.pc-pick-track`)
    expect(row.querySelectorAll(".pc-pick-track .archivist-toggle-box-checked").length).toBe(0);
  });

  it("a GRANTED pick's tracker renders in the granted row, checked to its used count", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, pickCtx(usesPool));
    const row = pickRow(el, true);
    expect(row.querySelectorAll(".pc-pick-track .archivist-toggle-box").length).toBe(2);
    expect(row.querySelectorAll(".pc-pick-track .archivist-toggle-box-checked").length).toBe(1);
    expect(row.querySelector(".pc-pick-track .pc-charge-recovery")!.textContent).toBe("/ Long Rest");
  });

  it("clicking a box writes the new used count through editState.setFeatureUse", () => {
    const calls: Array<[string, number]> = [];
    const c = pickCtx(usesPool);
    (c as { editState: unknown }).editState = { setFeatureUse: (id: string, n: number) => calls.push([id, n]) };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, c);
    pickRow(el, false).querySelector<HTMLElement>(".pc-pick-track .archivist-toggle-box")!.click();
    expect(calls).toEqual([["tce_cloud-rune", 1]]);
  });

  it("a pick carrying `uses` with NO seeded entry and NO index entry renders no tracker", () => {
    // The pre-G4 shape every cast fixture still has: `mkCtx` sets neither `feature_uses` nor
    // `resources`, so the guard returns before any box is drawn.
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(usesPool));
    expect(el.querySelector(".pc-pick-track")).toBeNull();
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(2);
  });
});

describe("PoolTab · the picks' own uses, the two guards and the custom tooltip (R4-G4 §12)", () => {
  it("RED FIRST (M-2): a `custom` reset carries the same tooltip every sibling tracker attaches", () => {
    const el = mountContainer();
    const c = pickCtx(usesPool);
    (c.resolved.resources as Map<string, object>).set("tce_cloud-rune", pickRes("tce_cloud-rune", "custom"));
    new PoolTab("interdict-boons").render(el, c);
    const cap = pickRow(el, false).querySelector(".pc-pick-track .pc-charge-recovery")!;
    expect(cap.getAttribute("title")).toBe(CUSTOM_RESET_TIP);
    expect(cap.textContent).toBe("/ Special");
  });

  it("M-3: a DESELECTED candidate with a STALE seeded key renders no tracker (the `!res` guard alone)", () => {
    // Measured, not assumed: `seedFeatureUses` never prunes (its own comment says stale ids from
    // no-longer-owned features are left untouched) and `renderSpellLike` renders every `available`
    // candidate, so a dropped pick can keep a `feature_uses` key. The index carries only
    // selected ∪ grants, so the candidate has no entry and `!res` returns before a box is drawn.
    // This is the ONLY case that isolates that guard: a prose pick fails `!fu` first, having never
    // been seeded at all.
    const withCandidate: ResolvedPool = { ...usesPool, available: [...usesPool.available,
      { slug: "hb_dropped", entity: ofEntity("hb_dropped", { uses: { max: 1, recharge: "long-rest" } }) as never }] };
    const c = pickCtx(withCandidate);
    (c.resolved.state.feature_uses as Record<string, object>)["hb_dropped"] = { used: 1, max: 1 };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, c);
    const row = Array.from(el.querySelectorAll<HTMLElement>(".pc-spell-prep-row"))
      .find((r) => r.querySelector(".pc-spell-name")?.textContent === "hb_dropped")!;
    expect(row.querySelector(".pc-pick-track")).toBeNull();
    // and the SELECTED pick beside it still has one, so the assertion above is not vacuous
    expect(pickRow(el, false).querySelectorAll(".pc-pick-track .archivist-toggle-box").length).toBe(1);
  });
});

describe("PoolTab · the control group (R4-G5 §4.2.2 b)", () => {
  const rowByName = (el: HTMLElement, name: string): HTMLElement =>
    Array.from(el.querySelectorAll<HTMLElement>(".pc-spell-prep-row"))
      .find((r) => r.querySelector(".pc-spell-name")?.textContent === name)!;

  /** A selected, activatable pick that BOTH tracks its own uses and spends a pool resource: the only
   *  shape on which the group's contents AND its position relative to the spend control are both
   *  observable. Cloud Rune is the measured carrier of the `uses` half. */
  const groupPool: ResolvedPool = {
    ...basePool, count: 2,
    selected: [{ slug: "tce_cloud-rune", entity: ofEntity("tce_cloud-rune", {
      activatable: true, uses: { max: 1, recharge: "short-rest" },
      consumes: { resource: "seals", amount: 1 },
    }) as never }],
    available: [{ slug: "tce_cloud-rune", entity: ofEntity("tce_cloud-rune", {
      activatable: true, uses: { max: 1, recharge: "short-rest" },
      consumes: { resource: "seals", amount: 1 },
    }) as never },
    { slug: "hell-mage", entity: ofEntity("hell-mage") as never }],
    // `activatable: true` on the GRANT is a CONSTRUCTION (neither of the two shipped `pool_grants`
    // entries carries it, both Elemental Attunement). It is what gives row 17's mutant its kill power at
    // the FIRST expect: without it, adding `renderControlGroup` to `grantedRow` renders no toggle and the
    // mutant survives the very assertion the spec names.
    grants: [{ slug: "tce_undying-servitude", entity: ofEntity("tce_undying-servitude", {
      activatable: true, uses: { max: 2, recharge: "long-rest" } }) as never }],
  };
  const groupCtx = (): ComponentRenderContext => {
    const c = ownedCtx(groupPool);                       // seeds "seals" + its index entry
    (c.resolved.state.feature_uses as Record<string, object>)["tce_cloud-rune"] = { used: 0, max: 1 };
    (c.resolved.state.feature_uses as Record<string, object>)["tce_undying-servitude"] = { used: 1, max: 2 };
    (c.resolved.resources as Map<string, object>).set("tce_cloud-rune", pickRes("tce_cloud-rune", "short-rest"));
    (c.resolved.resources as Map<string, object>).set("tce_undying-servitude", pickRes("tce_undying-servitude", "long-rest"));
    return c;
  };

  it("RED FIRST (row 16): the group sits BEFORE the spend control and holds the tracker, which is no longer in the namewrap", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, groupCtx());
    const row = rowByName(el, "tce_cloud-rune");
    const kids = Array.from(row.children);
    expect(kids.findIndex((n) => n.classList.contains("pc-buff-group")))
      .toBeLessThan(kids.findIndex((n) => n.classList.contains("pc-spend")));
    expect(row.querySelector(".pc-spell-namewrap .pc-pick-track")).toBeNull();
    expect(row.querySelector(".pc-buff-group .pc-pick-track")).not.toBeNull();
  });

  it("RED FIRST (row 44): inside the pool row's group the TRACKER precedes the toggle (the mirror of the boon row's order)", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, groupCtx());
    const group = rowByName(el, "tce_cloud-rune").querySelector<HTMLElement>(".pc-buff-group")!;
    expect(Array.from(group.children).map((n) => n.className))
      .toEqual(["pc-feature-track pc-pick-track", "pc-pool-active"]);
  });

  it("RED FIRST (row 17): a GRANTED row has NO toggle and keeps its tracker in the namewrap", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, groupCtx());
    const row = rowByName(el, "tce_undying-servitude");
    expect(row.querySelector(".pc-pool-active")).toBeNull();
    expect(row.querySelector(".pc-spell-namewrap .pc-pick-track")).not.toBeNull();
    expect(row.querySelector(".pc-buff-group")).toBeNull();
  });

  it("RED FIRST (row 43): an UNSELECTED candidate emits NO `.pc-buff-group` and keeps its two flex items", () => {
    // The candidate is never selected, so it has NO seeded `feature_uses` key (the live seed writes none
    // either) and `renderPickTracker` returns at `!fu`, with `!res` behind it because
    // `resolveResourceIndex` walks `selected` and `grants` only. The fixture needs no `uses` at all.
    // jsdom computes no layout, so the "two flex items and one 8 px gap" of §14 row 10 is asserted here
    // as the CHILD COUNT and lives as a width witness in the live task.
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, groupCtx());
    const row = rowByName(el, "hell-mage");
    expect(row.querySelector(".pc-buff-group")).toBeNull();
    expect(row.children.length).toBe(2);   // the select box + the namewrap
  });
});

// ── R4-G5 §3.2.2 · the sheet's half of the ONE visibility predicate (§13 row 41) ──
// FIXTURE-ONLY: on the 13-book install the filter removes nothing further from any pool whose owning
// class is in a VISIBLE compendium, because §9's collapse has already dropped the four SRD 5e fighting
// styles. The entries below carry the `compendium` string §9.2.1 stamps at resolve time.
describe("PoolTab · hidden compendiums (R4-G5 §3.2.2)", () => {
  const ent = (slug: string, compendium: string) =>
    ({ slug, compendium, entity: ofEntity(slug) as never });

  const hiddenPool = {
    ...basePool, count: 2,
    selected: [ent("hell-mage", "SRD 5e")],
    available: [ent("hell-mage", "SRD 5e"), ent("baleful-glare", "SRD 5e"), ent("visible-boon", "PHB")],
    grants: [],
  } as unknown as ResolvedPool;

  const hidingCtx = (pool: ResolvedPool, ...hiddenCompendiums: string[]): ComponentRenderContext => {
    const c = mkCtx(pool);
    (c as { services: unknown }).services = { plugin: { settings: { hiddenCompendiums } } };
    return c;
  };

  it("RED FIRST (row 41): a hidden candidate is absent from the spell-like list; a hidden SELECTED one stays", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, hidingCtx(hiddenPool, "SRD 5e"));
    const names = Array.from(el.querySelectorAll(".pc-spell-name")).map((n) => n.textContent);
    expect(names).not.toContain("baleful-glare");   // hidden, unselected: filtered
    expect(names).toContain("hell-mage");           // hidden BUT selected: exempt
    expect(names).toContain("visible-boon");
    // the filter runs on a COPY: the counter still reads the untouched `selected`
    expect(el.querySelector(".pc-spell-counts")?.textContent).toContain("1 / 2");
  });

  it("row 41: the `blocks` layout inherits the SAME filter (one filter, four layout entries)", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons", "blocks").render(el, hidingCtx(hiddenPool, "SRD 5e"));
    const titles = Array.from(el.querySelectorAll(".pc-block-title")).map((n) => n.textContent);
    expect(titles).not.toContain("baleful-glare");
    expect(titles).toContain("hell-mage");
    expect(titles).toContain("visible-boon");
  });

  it("no hidden compendiums, no change: every candidate renders (the control)", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, hidingCtx(hiddenPool));
    const names = Array.from(el.querySelectorAll(".pc-spell-name")).map((n) => n.textContent);
    expect(names).toContain("baleful-glare");
    expect(names.length).toBe(3);
  });
});

// ── R4-G5 §5 · the head on RESOLVED data, on every layout (§13 row 25) ──
// The function already guards itself three ways (`pool.resource`, its seeded `feature_uses` entry, its
// index entry) and already decides its own widget from `numeric`, so that guard gates the WIDGET (the
// §11 DC line prints BEFORE it, on its own null guard) and the change is four map entries.
// MEASURED 2026-09-07 on the 13-book install: exactly one head
// appears that did not before, the XGE Arcane Archer (5e)'s Arcane Shot Uses, and no pool gains a DC
// line, because the only DC-shaped pool owner on the install already derives `point-pool`.
describe("PoolTab · the head on every layout (R4-G5 §5)", () => {
  const arcane = {
    id: "fighter:arcane-shot-uses", name: "Arcane Shot Uses", reset: "short-rest", maxFormula: "2",
    owner: { kind: "feature", featureId: "as", featureName: "Arcane Shot",
             source: { kind: "subclass", slug: "aa", level: 3 } },
  };

  it("RED FIRST (row 25): a SPELL-LIKE pool with an owned resource renders the head", () => {
    const el = mountContainer();
    const c = withOwner({ ...basePool, resource: "fighter:arcane-shot-uses" }, { used: 0, max: 2 }, arcane);
    new PoolTab("interdict-boons").render(el, c);       // the DEFAULT layout: no hint, no authored value
    const head = el.querySelector(".pc-pool-head")!;
    expect(head.querySelectorAll(".archivist-toggle-box").length).toBe(2);
    expect(head.querySelector(".pc-pool-head-name")!.textContent).toBe("Arcane Shot Uses");
    expect(head.querySelector(".pc-charge-recovery")!.textContent).toBe("/ Short Rest");
    expect(head.querySelector(".pc-resource-die")).toBeNull();   // this resource declares none
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(3);   // the list still renders below
  });

  it("row 25: the BLOCKS layout gets the head too (every `LAYOUTS` entry, not just the hinted two)", () => {
    const el = mountContainer();
    const c = withOwner({ ...basePool, resource: "fighter:arcane-shot-uses" }, { used: 1, max: 2 }, arcane);
    new PoolTab("interdict-boons", "blocks").render(el, c);
    expect(el.querySelector(".pc-pool-head")!.querySelectorAll(".archivist-toggle-box").length).toBe(2);
    expect(el.querySelectorAll(".pc-boon-block").length).toBeGreaterThan(0);
  });

  it("a spell-like pool with NO `resource` and NO DC renders NO head (the guard gates the WIDGET)", () => {
    const el = mountContainer();
    const c = mkCtx(basePool);
    (c.resolved as { classes?: unknown }).classes = [];   // `poolSaveDC` indexes classes[pool.classIndex]
    new PoolTab("interdict-boons").render(el, c);
    expect(el.querySelector(".pc-pool-head")).toBeNull();
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(3);
  });

  it("FIXTURE-ONLY (§5.3): the DC line now reaches a SPELL-LIKE pool when one resolves (measured: zero shipped pools do)", () => {
    const el = mountContainer();
    const c = mkCtx(basePool);
    (c as { derived: unknown }).derived = { proficiencyBonus: 2, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 3, cha: 0 } };
    (c.resolved as { classes: unknown }).classes =
      [{ entity: { slug: "monk" }, level: 6, subclass: { slug: "fe", spellcasting: { ability: "wis" } } }];
    new PoolTab("interdict-boons").render(el, c);
    expect(el.querySelector(".pc-pool-dc")!.textContent).toBe("Interdict Boons save DC 13");
  });
});
