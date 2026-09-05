/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PassiveFeaturesTab } from "../packages/obsidian/src/modules/pc/components/passive-features-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { recalc } from "@archivist-gg/dnd5e/pc/pc.recalc";
import { resolveFeatureResources } from "@archivist-gg/dnd5e/pc/pc.resources";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type {
  ResolvedCharacter,
  ResolvedClass,
  ResolvedFeature,
  ResolvedPool,
  ResolvedPoolEntry,
} from "@archivist-gg/dnd5e/pc/pc.types";
import type { FeatureEffect } from "@archivist-gg/dnd5e/types/feature-effect";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { BackgroundEntity } from "@archivist-gg/dnd5e/background/background.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// R4-G3a §4 · the row-local caption line.
//
// `renderEffectCaptions` hangs off `renderFeatureRow`, so the mount is the
// PASSIVE tab: it renders the very same `renderFeatureRow` and is the one
// working mount precedent in this suite (tests/pc-passive-features-tab.test.ts).
// The ctx builder below is that file's reconciled `renderCtx` (its `rf` /
// `entry` / `pool` helpers and the `resolved` + `derived` shape), copied so this
// file stands alone.
//
// DOM queries here use `Array.from` rather than spread: the repo's `lib` has no
// `DOM.Iterable`, so `[...querySelectorAll(…)]` is a tsc error. The file this
// builder came from carries 19 of them (TS2488); its twentieth base error is an
// unrelated TS2353 at :109, not a spread.
// ─────────────────────────────────────────────────────────────

const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 }, ...extra }) as unknown as ResolvedFeature;

const entry = (slug: string, entity: Partial<OptionalFeatureEntity> = {}): ResolvedPoolEntry =>
  ({ slug, entity: { slug, name: slug, description: "", edition: "2014", source: "", feature_type: "boon", prerequisites: [], available_to: [], effects: [], ...entity } }) as unknown as ResolvedPoolEntry;

const pool = (over: Partial<ResolvedPool> = {}): ResolvedPool =>
  ({ id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 3, selected: [], available: [], grants: [], ...over }) as ResolvedPool;

interface RenderOpts {
  featureUses?: Record<string, { used: number; max: number }>;
  classes?: object[];
  totalLevel?: number;
  editState?: object | null;
  actionsDisabled?: boolean;
  pools?: ResolvedPool[];
  activeBuffs?: string[];
  race?: RaceEntity | null;
  background?: BackgroundEntity | null;
}

function renderCtx(features: ResolvedFeature[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: opts.race ?? null, classes: opts.classes ?? [], background: opts.background ?? null, feats: [],
      totalLevel: opts.totalLevel ?? 5, features, pools: opts.pools ?? [],
      state: { feature_uses: opts.featureUses ?? {}, active_buffs: opts.activeBuffs ?? [] },
    } as unknown as ResolvedCharacter,
    derived: {
      attacks: [],
      attacksPerAction: 1,
      conditionEffects: opts.actionsDisabled ? { actions_disabled: true, sources: [] } : undefined,
    } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const rowByName = (root: HTMLElement, name: string): HTMLElement =>
  Array.from(root.querySelectorAll<HTMLElement>(".pc-feature-row")).find(
    (r) => r.querySelector(".pc-action-row-name")?.textContent === name,
  )!;

/** Every caption TEXT on a row, in render order. */
const captions = (row: HTMLElement): string[] =>
  Array.from(row.querySelectorAll(".pc-feature-effect-line .pc-feature-effect")).map((n) => n.textContent ?? "");

/** Mount one feature on the passive tab and hand back its row. */
function renderOne(feature: object, opts: RenderOpts = {}): { root: HTMLElement; row: HTMLElement } {
  const root = mountContainer();
  const name = (feature as { name: string }).name;
  new PassiveFeaturesTab().render(root, renderCtx([rf(feature)], opts));
  return { root, row: rowByName(root, name) };
}

// ── the recalc half of invariant 1 (a plugin-side driver over the dnd5e engine) ──
// `mkClass` / `emptyResolved` / `effectFeature` / `resolvedWith` mirror
// dnd5e tests/pc-recalc-feature-effects.test.ts:11-65. `pools` and
// `weaponMasteries` are spelled here (that file's copy predates both fields and
// carries a TS2739 for the omission; a NEW file contributes 0 errors).

function mkClass(slug: string, die: string, level: number): ResolvedClass {
  return {
    entity: {
      slug, name: slug, edition: "2014", hit_die: die,
      primary_abilities: ["str"], saving_throws: [], features_by_level: {},
    } as never,
    level,
    subclass: null,
    choices: {},
  };
}

function emptyResolved(): ResolvedCharacter {
  const state = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] };
  return {
    definition: {
      name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [], overrides: {}, state,
    } as never,
    race: null, classes: [], background: null, feats: [], totalLevel: 0,
    features: [], spells: [], pools: [], weaponMasteries: [],
    state: state as never,
  };
}

function resolvedWith(level: ResolvedClass, effects: FeatureEffect[]): ResolvedCharacter {
  const r = emptyResolved();
  r.classes = [level];
  r.features.push({ feature: { name: "Effect Source", effects } as never, source: { kind: "race", slug: "test-race" } });
  return r;
}

describe("renderEffectCaptions", () => {
  it("renders the heal caption beside the resource tracker (Second Wind, PHB 2014)", () => {
    const { row } = renderOne(
      {
        name: "Second Wind", id: "second-wind", description: "x",
        resources: [{ id: "fighter:second-wind", name: "Second Wind", max_formula: "1", reset: "short-rest" }],
        effects: [{ kind: "heal", amount: "1d10 + your fighter level", subject: "self" }],
      },
      { featureUses: { "fighter:second-wind": { used: 0, max: 1 } } },
    );
    // The tracker owns the single detail slot; the caption is a block child of
    // the NAME cell, so the two coexist on one row.
    expect(row.querySelector(".pc-feature-track")).toBeTruthy();
    expect(row.querySelector(".pc-action-namecell > .pc-feature-effect-line")).toBeTruthy();
    // ECHOED verbatim, never evaluated: `evaluateMaxFormula` throws on this prose.
    expect(captions(row)).toEqual(["Heals 1d10 + your fighter level"]);
  });

  it("renders the temp-hp caption and plain-texts its qualifier into the tooltip", () => {
    const { row } = renderOne({
      name: "Arcane Propulsion Armor", description: "x",
      effects: [{ kind: "temp-hp", amount: "your Artificer level", condition: "While *Bloodied*", subject: "self" }],
    });
    const span = row.querySelector(".pc-feature-effect-line .pc-feature-effect");
    expect(span?.textContent).toBe("Temp HP your Artificer level");
    expect(span?.getAttribute("aria-label")).toBe("While Bloodied");
  });

  it("renders extra-action through the shared action-cost label table", () => {
    const { row } = renderOne({
      name: "Cunning Action", description: "x",
      effects: [{ kind: "extra-action", count: 1, action_type: "bonus-action", subject: "self" }],
    });
    expect(captions(row)).toEqual(["+1 Bonus"]);
  });

  it("renders a NON-self imposition as a caption while the fold still refuses it", () => {
    const imposed: FeatureEffect = { kind: "roll-modifier", mode: "disadvantage", roll: "saving-throw", subject: "target" };
    const { row } = renderOne({ name: "Hound of Ill Omen", description: "x", effects: [imposed] });
    expect(captions(row)).toEqual(["target: disadvantage on saving throws"]);

    // Invariant 1: the RENDER is new, the fold is not. The same effect written
    // on the character folds nothing onto the player's own rolls.
    const d = recalc(resolvedWith(mkClass("sorcerer", "d6", 6), [imposed]));
    expect(d.rollModifiers.length).toBe(0);
    // Control: only the `subject` makes the difference · a self-subject copy of
    // the same effect DOES fold, so the zero above is the guard and not recalc
    // dropping roll-modifiers wholesale.
    const self = recalc(resolvedWith(mkClass("sorcerer", "d6", 6), [{ ...imposed, subject: "self" }]));
    expect(self.rollModifiers.length).toBe(1);
  });

  // ── `restate`, arm by arm (every arm reachable through a non-self subject) ──

  it("keeps the condition NAME in the body on apply-condition, with no tooltip", () => {
    const { row } = renderOne({
      name: "Hound of Ill Omen", description: "x",
      effects: [{ kind: "apply-condition", condition: "Frightened", subject: "target" }],
    });
    // `condition` is the NAME on this arm (dnd5e types/feature-effect.ts builds it from `& Subject`,
    // not `& Qualified`). Echoing it into a tooltip as well would repeat it; treating it AS a
    // qualifier would hide the only word the caption has.
    expect(captions(row)).toEqual(["target: Frightened"]);
    expect(row.querySelector(".pc-feature-effect")?.getAttribute("aria-label")).toBeNull();
  });

  it("restates immune-condition with its `while` scope, and without one when absent", () => {
    const withWhile = renderOne({
      name: "Aura of Purity", description: "x",
      effects: [{ kind: "immune-condition", condition: "Poisoned", while: "within 30 feet", subject: "allies" }],
    });
    expect(captions(withWhile.row)).toEqual(["allies: Poisoned while within 30 feet"]);
    expect(withWhile.row.querySelector(".pc-feature-effect")?.getAttribute("aria-label")).toBeNull();

    const bare = renderOne({
      name: "Aura of Purity", description: "x",
      effects: [{ kind: "immune-condition", condition: "Poisoned", subject: "allies" }],
    });
    // No trailing space, no dangling "while".
    expect(captions(bare.row)).toEqual(["allies: Poisoned"]);
  });

  it("restates damage-bonus from its own amount and damage type", () => {
    const { row } = renderOne({
      name: "Hex", description: "x",
      effects: [{ kind: "damage-bonus", amount: "1d6", damage_type: "fire", subject: "target" }],
    });
    expect(captions(row)).toEqual(["target: 1d6 fire"]);
  });

  it("restates an unmodelled kind through the default arm as a key/value list", () => {
    const { row } = renderOne({
      name: "Slow Aura", description: "x",
      effects: [{ kind: "speed-bonus", mode: "walk", value: 10, subject: "target" }],
    });
    // `kind` names the effect; `subject` and `condition` are dropped (they are rendered elsewhere on
    // the line). Measured, then pinned.
    expect(captions(row)).toEqual(["target: speed-bonus mode=walk value=10"]);
  });

  it('reads roll: "any" as "rolls", never as one roll type', () => {
    const { row } = renderOne({
      name: "Bless", description: "x",
      effects: [{ kind: "roll-modifier", mode: "advantage", roll: "any", subject: "allies" }],
    });
    // An `any` modifier covers checks, saves AND attacks; "ability checks" would understate it.
    expect(captions(row)).toEqual(["allies: advantage on rolls"]);
  });

  it("renders NO caption for a self effect outside the caption kinds", () => {
    const { row } = renderOne({
      name: "Dwarven Resilience", description: "x",
      effects: [{ kind: "resistance", damage_type: "poison", subject: "self" }],
    });
    // The row itself rendered · the absence below is about the caption, not an
    // empty host.
    expect(row.querySelector(".pc-action-row-name")?.textContent).toBe("Dwarven Resilience");
    expect(row.querySelector(".pc-feature-effect-line")).toBeNull();
  });

  it("renders NO caption on a boon row (the named exclusion)", () => {
    const root = mountContainer();
    new PassiveFeaturesTab().render(root, renderCtx([], {
      pools: [pool({ selected: [entry("x", { effects: [{ kind: "heal", amount: "5" }] })] })],
    }));
    // The boon row rendered and carries a caption-bearing effect · the caption
    // line is absent because boons bypass `renderFeatureRow` entirely.
    expect(Array.from(root.querySelectorAll(".pc-boon-row")).length).toBe(1);
    expect(root.querySelector(".pc-feature-effect-line")).toBeNull();
  });
});

// The die label is not a caption, so it gets its own describe rather than reading
// as "renderEffectCaptions > …" (the brief wrote the `it` at describe-body indent
// and named no host describe; §17 row 37 names only the FILE).
describe("renderCardResource · the die level (R4-G4 §6.2.4)", () => {
  it("R4-G4 §6.2.4: the card's die label scales at the OWNER's class level (Bard 4 / Fighter 6 reads d6, not d10)", async () => {
    const { resolveFeatureResources } = await import("@archivist-gg/dnd5e/pc/pc.resources");
    const { renderCardResource } = await import("../packages/obsidian/src/modules/pc/components/actions/feature-rows");
    const bard = rf({ id: "bardic-inspiration", name: "Bardic Inspiration", resources: [{ id: "bard:bardic-inspiration", name: "Bardic Inspiration",
      max_formula: "{cha_mod}", die: { base: "d6", scaling: { "5": "d8", "10": "d10" } }, reset: "short-rest" }] },
      { source: { kind: "class", slug: "bard", level: 1 } });
    const ctx = renderCtx([bard], { classes: [{ entity: { slug: "bard" }, level: 4 }, { entity: { slug: "fighter" }, level: 6 }],
      featureUses: { "bard:bardic-inspiration": { used: 0, max: 3 } }, totalLevel: 10 });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([bard]);
    // §17 row 37's fixture contract: the index entry's owner is the Bard class AND classes[] carries { slug: "bard", level: 4 }
    // (resourceLevelFor finds the class BY SLUG); totalLevel 10 is the mutant's own value. renderCardResource is EXPORTED
    // and called directly, so resources[0] is fine here; through the row a die must sit at resources[1..N].
    const host = mountContainer();
    renderCardResource(host, bard.feature.resources![0], ctx);
    expect(host.querySelector(".pc-resource-die")!.textContent).toBe("d6");
  });
});

// ─────────────────────────────────────────────────────────────
// R4-G4 §3.2.5 · the spend control in the row's single detail slot, and the
// owner-and-spender rule that keeps a box tracker from double-rendering it.
// ─────────────────────────────────────────────────────────────
describe("renderFeatureRow · the spend control (R4-G4 §3.2.5)", () => {
  it("R4-G4 §3.2.5: a pure spender (Flurry of Blows) carries the control in the slot", () => {
    const flurry = rf({ id: "flurry", name: "Flurry of Blows", consumes: { resource: "monk:ki", amount: 1 } });
    const ctx = renderCtx([flurry], { featureUses: { "monk:ki": { used: 0, max: 5 } } });
    (ctx.resolved as { resources?: unknown }).resources = new Map([["monk:ki", { id: "monk:ki", name: "Ki", reset: "short-rest", maxFormula: "5", owner: { kind: "feature", featureId: "ki", featureName: "Ki", source: { kind: "class", slug: "monk", level: 2 } } }]]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    expect(rowByName(c, "Flurry of Blows").querySelector("button.pc-spend-control")!.textContent).toBe("Spend 1 Ki");
  });

  it("Rage, the owner-and-spender case: the control is in neither the card nor the row", () => {
    const rage = rf({ id: "rage", name: "Rage", consumes: { resource: "barbarian:rages", amount: 1 },
      resources: [{ id: "barbarian:rages", name: "Rage", max_formula: "2", reset: "long-rest" }] });
    const ctx = renderCtx([rage], { featureUses: { "barbarian:rages": { used: 0, max: 2 } } });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([rage]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    // m3's RED FIRST (Gate 2 I-1 / confirmation r1 I-5): the card is the row's next SIBLING (`.pc-action-expand`), not a
    // descendant, so a row-scoped query cannot see a control the mutant moves into the card. The card read is assertion ONE.
    expect((rowByName(c, "Rage").nextElementSibling as HTMLElement).querySelector("button.pc-spend-control")).toBeNull();
    expect(rowByName(c, "Rage").querySelector("button.pc-spend-control")).toBeNull();
    expect(rowByName(c, "Rage").querySelectorAll(".archivist-toggle-box").length).toBe(2);
  });

  it("a non-owner spender with an attack note: the control takes the slot and the note follows it into the card", () => {
    const psi = rf({ id: "psionic-strike", name: "Psionic Strike", consumes: { resource: "psi:energy-die", amount: 1 },
      attacks: [{ to_hit: "+5", damage: "1d8" }] });
    const ctx = renderCtx([psi], { featureUses: { "psi:energy-die": { used: 0, max: 4 } } });
    (ctx.resolved as { resources?: unknown }).resources = new Map([["psi:energy-die", { id: "psi:energy-die", name: "Psionic Energy Die", reset: "long-rest", maxFormula: "4", owner: { kind: "feature", featureId: "pp", featureName: "Psionic Power", source: { kind: "subclass", slug: "psi-warrior", level: 3 } } }]]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    // The slot is single-occupancy: before R4-G4 the note held it and a control could not exist; now the
    // control holds it and the note is NOT dropped, it lands in the expand card (the Finding B route).
    const card = rowByName(c, "Psionic Strike").nextElementSibling as HTMLElement;
    expect(card.querySelector(".pc-feature-card-attack")!.textContent).toBe("Attack: +5 · 1d8");
    expect(rowByName(c, "Psionic Strike").querySelector("button.pc-spend-control")!.textContent).toBe("Spend 1 Psionic Energy Die");
    expect(rowByName(c, "Psionic Strike").querySelector(".pc-feature-attack-note")).toBeNull();
  });
});
