/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool, ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// Fixtures: a ResolvedCharacter carrying selection pools (§3.6). Boons file
// into the economy×source grid model as "boons" sub-groups (Passive/Actions/…
// ← entity.action_cost); since R4-G4 §10 the sub-group HEAD reads the pool
// labels it holds (UR3).
// ─────────────────────────────────────────────────────────────
const entry = (slug: string, entity: Partial<OptionalFeatureEntity> = {}): ResolvedPoolEntry =>
  ({ slug, entity: { slug, name: slug, description: "", edition: "2014", source: "", feature_type: "boon", prerequisites: [], available_to: [], effects: [], ...entity } }) as unknown as ResolvedPoolEntry;

const pool = (over: Partial<ResolvedPool> = {}): ResolvedPool =>
  ({ id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 3, selected: [], available: [], grants: [], ...over }) as ResolvedPool;

interface RenderOpts {
  activeBuffs?: string[];
  editState?: object | null;
  actionsDisabled?: boolean;
}

function renderCtx(pools: ResolvedPool[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: null, classes: [], background: null, feats: [],
      totalLevel: 5, features: [], pools,
      state: { feature_uses: {}, active_buffs: opts.activeBuffs ?? [] },
    } as unknown as ResolvedCharacter,
    derived: {
      attacks: [], attacksPerAction: 1,
      conditionEffects: opts.actionsDisabled ? { actions_disabled: true, sources: [] } : undefined,
    } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const boonRows = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(".pc-boon-row")];
const boonRowByName = (root: HTMLElement, name: string): HTMLElement =>
  boonRows(root).find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;

describe("ActionsTab — boons in the economy×source model (§3.6)", () => {
  // The passive/free/special/no-cost boon cases (files-under-Passive, Active
  // toggle, on-state, Passive tag, granted FREE-pill/marker, read-only granted
  // tag, expand card, toggle-doesn't-expand) all file under the passive bucket
  // → they moved to pc-passive-features-tab.test.ts. Only the two clean
  // action-economy cases (an action boon dims; a bonus boon dims) stay here.

  it("gives a selected activatable boon its economy pill + Active toggle (no status marker)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([pool({ selected: [entry("wrath", { name: "Wrath", action_cost: "action", activatable: true })] })]));
    const row = boonRowByName(c, "Wrath");
    expect(row.querySelector(".pc-cost-badge.cost-action")).toBeTruthy();
    expect(row.querySelector(".pc-pool-active")).toBeTruthy();
    expect(row.querySelector(".pc-boon-status")).toBeNull();
  });

  // "shows the 'Passive' tag for a special boon" (special → passive) moved to
  // pc-passive-features-tab.test.ts.

  it("dims a bonus-action boon when actions are disabled (free-boon split off)", () => {
    // SPLIT from the old single-tab test: the free-boon half (Free Boon NOT dimmed)
    // now lives in pc-passive-features-tab.test.ts. A free boon files under the
    // passive bucket, so only the bonus-action dimming assertion stays here.
    const c1 = mountContainer();
    new ActionsTab().render(c1, renderCtx([pool({ selected: [entry("b", { name: "BA Boon", action_cost: "bonus-action" })] })], { actionsDisabled: true }));
    expect(boonRowByName(c1, "BA Boon").classList.contains("pc-row-disabled")).toBe(true);
  });

  // The read-only 'granted' tag, the boon-row expand card, and the
  // "Active toggle doesn't expand" cases (all no-cost → passive) moved to
  // pc-passive-features-tab.test.ts.

  it("renders nothing when the character has no pools", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([]));
    expect(boonRows(c)).toEqual([]);
  });

  it("R4-G4 §3: a selected boon that consumes an OWNED resource carries the spend control; clicking spends 1", () => {
    const c = mountContainer();
    const spend = vi.fn();
    const ctx = renderCtx([pool({ selected: [entry("parry", { name: "Parry", action_cost: "reaction", consumes: { resource: "fighter-2024:superiority-dice", amount: 1 } })] })], { editState: { spendFeatureUse: spend } });
    (ctx.resolved.state as { feature_uses: unknown }).feature_uses = { "fighter-2024:superiority-dice": { used: 0, max: 4 } };
    (ctx.resolved as { resources?: unknown }).resources = new Map([["fighter-2024:superiority-dice", { id: "fighter-2024:superiority-dice", name: "Superiority Dice", reset: "short-rest", maxFormula: "4", die: { base: "d8" }, owner: { kind: "feature", featureId: "cs", featureName: "Combat Superiority", source: { kind: "subclass", slug: "bm", level: 3 } } }]]);
    new ActionsTab().render(c, ctx);
    const btn = boonRowByName(c, "Parry").querySelector<HTMLButtonElement>("button.pc-spend-control")!;
    expect(btn.textContent).toBe("Spend 1 Superiority Dice (d8)");
    btn.click();
    expect(spend).toHaveBeenCalledWith("fighter-2024:superiority-dice", 1);
  });

  it("RED FIRST (R4-G4 §10, UR3): the boon sub-group head reads the pool's own label, not 'Boons'", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([pool({ id: "metamagic", label: "Metamagic", selected: [entry("twinned", { name: "Twinned Spell", action_cost: "action" })] })]));
    const titles = Array.from(c.querySelectorAll(".pc-actions-section-head .pc-actions-section-title")).map((n) => n.textContent);
    expect(titles).toContain("Metamagic");
    expect(titles).not.toContain("Boons");
  });

  it("two pools in one economy join their labels in pool order", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ id: "invocations", label: "Eldritch Invocations", selected: [entry("agonizing", { name: "Agonizing Blast", action_cost: "action" })] }),
      pool({ id: "pact-boon", label: "Pact Boon", selected: [entry("blade", { name: "Pact of the Blade", action_cost: "action" })] }),
    ]));
    const titles = Array.from(c.querySelectorAll(".pc-actions-section-head .pc-actions-section-title")).map((n) => n.textContent);
    // `buildActionModel` walks `resolved.pools` in order and `mergeFeatureEntries` only
    // reorders `feature` entries, so the entry order IS the pool order.
    expect(titles).toContain("Eldritch Invocations · Pact Boon");
  });

  it("RED FIRST (R4-G4 §10, UR3): a boons sub-group whose entries carry NO pool label falls back to the shipped 'Boons' literal", () => {
    // The ONE path to `SOURCE_LABEL.boons` in `buildActionModel`, and nothing pinned it until now:
    // every other assertion on the literal in this file is the NEGATIVE in the pool-label test
    // above (review I-1). It is REACHABLE on real data, not a synthetic case: the sheet resolves
    // RAW entities (invariant 1) and the codec that enforces `label: z.string().min(1)` runs on
    // the note path only, so a pool whose label is empty or absent arrives with `poolLabel` falsy,
    // the distinct-label join collapses to "", and the fallback supplies the head.
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([pool({ id: "unlabelled", label: "", selected: [entry("surge", { name: "Surge", action_cost: "action" })] })]));
    const titles = Array.from(c.querySelectorAll(".pc-actions-section-head .pc-actions-section-title")).map((n) => n.textContent);
    expect(titles).toContain("Boons");
    // The sub-group is not empty: the head above belongs to a rendered boon.
    expect(boonRowByName(c, "Surge")).toBeTruthy();
  });

  it("RED FIRST: a boon row with a heal effect renders the G3a caption; the row no longer repeats the pool label", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([pool({ label: "Metamagic", selected: [entry("mend", { name: "Mend", action_cost: "action", effects: [{ kind: "heal", amount: "1d8" }] })] })]));
    const row = boonRowByName(c, "Mend");
    // Measured wording: `effect-captions.ts` NOUN.heal = "Heals", rendered by `restate`.
    expect(row.querySelector(".pc-feature-effect")?.textContent).toBe("Heals 1d8");
    expect(row.querySelector(".pc-action-row-sub")).toBeNull();
    // The expanded card still names the pool (`renderBoonRow` keeps the `poolLabel`
    // parameter and passes it as the card's `sourceLabel`, which `renderFeatureCard`
    // renders into `.archivist-item-subtitle`).
    row.click();
    expect(c.querySelector(".pc-action-expand:not([hidden]) .archivist-item-subtitle")?.textContent).toBe("Metamagic");
  });

  it("keeps the 4-child badge layout on the Actions tab (D3 is passive-only)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([pool({ selected: [entry("wrath", { name: "Wrath", action_cost: "action" })] })]));
    const row = boonRowByName(c, "Wrath");
    expect(row.querySelector(".pc-feature-badge")).toBeTruthy();
    expect(row.childElementCount).toBe(4);
    expect(row.querySelector(".pc-feature-badge .pc-cost-badge.cost-action")).toBeTruthy();
  });
});

describe("ActionsTab · a boon's OWN uses (R4-G4 §12)", () => {
  /** Cloud Rune is a real TCE carrier (`rune`, `max: 1`, `short-rest`); the max 2 is this fixture's,
   *  so the box count cannot be satisfied by an off-by-one. The boon ALSO consumes a resource, which
   *  is what lets the slot's ORDER be asserted: `renderBoonRow` renders the tracker before the spend
   *  control (review I-2; the placement §12.2 fixes and nothing else pinned). */
  const owned = () => {
    const ctx = renderCtx([pool({ selected: [entry("tce_cloud-rune", {
      name: "Cloud Rune", action_cost: "reaction",
      uses: { max: 2, recharge: "short-rest" },
      consumes: { resource: "fighter-2024:superiority-dice", amount: 1 },
    })] })], { editState: { spendFeatureUse: () => {}, setFeatureUse: () => {} } });
    (ctx.resolved.state as { feature_uses: unknown }).feature_uses = {
      "tce_cloud-rune": { used: 1, max: 2 },
      "fighter-2024:superiority-dice": { used: 0, max: 4 },
    };
    (ctx.resolved as { resources?: unknown }).resources = new Map([
      ["tce_cloud-rune", { id: "tce_cloud-rune", name: "Cloud Rune", reset: "short-rest", maxFormula: "1",
        owner: { kind: "pool", poolId: "interdict-boons", poolLabel: "Interdict Boons", source: { kind: "class", slug: "fighter", level: 3 } } }],
      ["fighter-2024:superiority-dice", { id: "fighter-2024:superiority-dice", name: "Superiority Dice", reset: "short-rest", maxFormula: "4",
        owner: { kind: "feature", featureId: "cs", featureName: "Combat Superiority", source: { kind: "subclass", slug: "bm", level: 3 } } }],
    ]);
    return ctx;
  };

  /** `owned()` with the Active toggle in play. Cloud Rune IS `activatable` in the corpus; the shipped
   *  `owned()` fixture omits the flag, and a group holding only a tracker cannot pin the ORDER. */
  const ownedActivatable = () => {
    const ctx = owned();
    const e = ctx.resolved.pools![0].selected[0].entity as { activatable?: boolean };
    e.activatable = true;
    return ctx;
  };

  /** `owned()` with the same entry GRANTED instead of selected: the granted arm renders the "granted"
   *  marker and the tracker as direct children of the detail slot, never a group. A CONSTRUCTION: no
   *  shipped `pool_grants` entry carries `uses` (measured, both of the install's two are Elemental
   *  Attunement). */
  const grantedOwned = () => {
    const ctx = owned();
    const p = ctx.resolved.pools![0];
    p.grants = p.selected;
    p.selected = [];
    return ctx;
  };

  it("RED FIRST: the boon row's detail slot carries the pick's tracker, spent to its used count", () => {
    const c = mountContainer();
    new ActionsTab().render(c, owned());
    const detail = boonRowByName(c, "Cloud Rune").querySelector<HTMLElement>(".pc-feature-detail")!;
    expect(detail.querySelectorAll(".pc-pick-track .archivist-toggle-box").length).toBe(2);
    expect(detail.querySelectorAll(".pc-pick-track .archivist-toggle-box-checked").length).toBe(1);
    expect(detail.querySelector(".pc-pick-track .pc-charge-recovery")!.textContent).toBe("/ Short Rest");
  });

  it("R4-G5 §4.2.2 (b): the boon row's group precedes the spend control, and holds the toggle then the tracker", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ownedActivatable());
    const detail = boonRowByName(c, "Cloud Rune").querySelector<HTMLElement>(".pc-feature-detail")!;
    const group = detail.querySelector<HTMLElement>(".pc-buff-group")!;
    // assertion ONE, and row 15's RED: the group's index in the detail slot is less than the spend
    // control's. It is FIRST because invariant 4 requires the RED assertion to be the first `expect`
    // in its `it()`, and t5-m15 (which moves the group AFTER the spend control) leaves the group's
    // CONTENTS unchanged, so only this comparison reds under it. ONE `it()` is kept: the two
    // assertions are two properties of one placement and t5-m44's boon-row control stays green either way.
    const kids = Array.from(detail.children);
    expect(kids.findIndex((n) => n.classList.contains("pc-buff-group")))
      .toBeLessThan(kids.findIndex((n) => n.classList.contains("pc-spend")));
    // assertion TWO: the tracker is a child of the GROUP (not of the detail slot), in the boon row's
    // shipped toggle-then-tracker order (t5-m44's RED lives on the POOL row's mirror of this)
    expect(Array.from(group.children).map((n) => n.className))
      .toEqual(["pc-pool-active", "pc-feature-track pc-pick-track"]);
  });

  it("R4-G5 §4.2.2 (b): a GRANTED boon row keeps its tracker as a direct child of the detail slot, outside any group", () => {
    // A PRESENCE assertion, named in §13's "Named NON-mutants" line: it carries no mutant row of its
    // own. A construction, too: no shipped `pool_grants` entry carries `uses` (measured, both of the
    // install's two are Elemental Attunement). It guards the split of `renderBoonRow`'s single
    // unconditional `renderPickTracker` call into a granted arm and a group.
    const c = mountContainer();
    new ActionsTab().render(c, grantedOwned());
    const detail = boonRowByName(c, "Cloud Rune").querySelector<HTMLElement>(".pc-feature-detail")!;
    expect(Array.from(detail.children).map((n) => n.className))
      .toEqual(["pc-boon-status", "pc-feature-track pc-pick-track", "pc-spend"]);
    expect(detail.querySelector(".pc-buff-group")).toBeNull();
  });
});
