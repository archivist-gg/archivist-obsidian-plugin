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
// `renderEffectCaptions` hangs off `renderFeatureRow` AND (since R4-G4 §10)
// `renderBoonRow`, so the mount is the PASSIVE tab: it renders the very same
// `renderFeatureRow` and is the one working mount precedent in this suite
// (tests/pc-passive-features-tab.test.ts).
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

  // CHARACTERISATION PIN (R4-G7 fix round 1, W-D-D6): the CSS gives an EMPTY detail slot's track to the name through
  // `.pc-feature-detail:empty`, which only matches a slot with NO child node at all (a whitespace text node would defeat it).
  // A feature with no tracker, no spend control and no attack note leaves the slot that empty.
  it("a row with nothing for its detail slot leaves the slot with no child node, so `:empty` matches it", () => {
    const { row } = renderOne({ name: "Divine Intervention Improvement", description: "x" });
    const detail = row.querySelector(":scope > .pc-feature-detail");
    expect(detail?.childNodes.length).toBe(0);
    expect(detail?.matches(":empty")).toBe(true);
  });

  // R4-G7 T8 fix round 1 (W-D-D3, the W-D eye re-read, conv-assassin-5e-20 panel-passive__1): the caption read "+1 Bonus", cut where
  // Action Surge reads "+1 Action". The caption names the economy in running text, so it takes the table's LONG form; the badge keeps
  // the short "Bonus" (`tests/pc-actions-cost-badge.test.ts`). [Moved here from above the `:empty` pin in R4-G7 T8 wave E: it had been
  // written over the W-D-D6 test, which is about a different rider.]
  it("renders extra-action through the shared action-cost label table's LONG form", () => {
    const { row } = renderOne({
      name: "Cunning Action", description: "x",
      effects: [{ kind: "extra-action", count: 1, action_type: "bonus-action", subject: "self" }],
    });
    expect(captions(row)).toEqual(["+1 Bonus Action"]);
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

  it("renders the caption on a boon row too (R4-G4 §10 REVERSED the named exclusion)", () => {
    const root = mountContainer();
    new PassiveFeaturesTab().render(root, renderCtx([], {
      pools: [pool({ selected: [entry("x", { effects: [{ kind: "heal", amount: "5" }] })] })],
    }));
    // Boons still bypass `renderFeatureRow`; since R4-G4 §10 `renderBoonRow` makes the
    // SAME `renderEffectCaptions` call into its own name cell, so the caption is there.
    expect(root.querySelector(".pc-boon-row .pc-feature-effect")?.textContent).toBe("Heals 5");
    expect(Array.from(root.querySelectorAll(".pc-boon-row")).length).toBe(1);
    expect(root.querySelector(".pc-boon-row .pc-action-namecell > .pc-feature-effect-line")).toBeTruthy();
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

  // R4-G4 T3 review M-5, closed at T5 review M-6: the `custom` recovery tooltip reaches the BOXES
  // through `recoveryTitle`, but a resource above CHARGE_BOX_LIMIT hands off to `renderLarge`, and
  // the two feature sites built their `renderPointPool` opts without `resetTitle`, so the tooltip was
  // lost at exactly the two sites M-5 named. Both are pinned here.
  it("RED FIRST: a custom-reset resource above CHARGE_BOX_LIMIT keeps its recovery tooltip on the numeric path (both feature sites)", async () => {
    const { renderCardResource, renderFirstResourceTracker } =
      await import("../packages/obsidian/src/modules/pc/components/actions/feature-rows");
    const TIP = "Recovery is described in this feature's text";
    const runes = rf({ id: "rune-carver", name: "Rune Carver", resources: [
      { id: "rune:charges", name: "Rune Charges", max_formula: "25", reset: "custom" },
    ] });
    const ctx = renderCtx([runes], { featureUses: { "rune:charges": { used: 0, max: 25 } } });

    const card = mountContainer();
    renderCardResource(card, runes.feature.resources![0], ctx);
    expect(card.querySelector(".pc-point-pool-reset")!.getAttribute("title")).toBe(TIP);
    // The `·` is the rider's separator (V-7); the caption itself is unchanged.
    expect(card.querySelector(".pc-point-pool-reset")!.textContent).toBe("· Special");

    const row = mountContainer();
    renderFirstResourceTracker(row, runes.feature, ctx);
    expect(row.querySelector(".pc-point-pool-reset")!.getAttribute("title")).toBe(TIP);

    // The control: a non-`custom` reset carries no tooltip, so the title is not unconditional.
    const plain = rf({ id: "lay-on-hands", name: "Lay on Hands", resources: [
      { id: "paladin:lay-on-hands", name: "Lay on Hands", max_formula: "25", reset: "long-rest" },
    ] });
    const plainCtx = renderCtx([plain], { featureUses: { "paladin:lay-on-hands": { used: 0, max: 25 } } });
    const plainHost = mountContainer();
    renderCardResource(plainHost, plain.feature.resources![0], plainCtx);
    expect(plainHost.querySelector(".pc-point-pool-reset")!.getAttribute("title")).toBeNull();
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

  it("an AT-WILL owner-spender renders no control at all: there is nothing to spend down", () => {
    // The third widget (R4-G4 §5): `max === AT_WILL_MAX` renders the words "at will" and no boxes,
    // so no click spends anything and a Spend button would write into a count the tracker ignores.
    const atWill = rf({ id: "rage", name: "Rage", consumes: { resource: "barbarian:rages", amount: 1 },
      resources: [{ id: "barbarian:rages", name: "Rage", max_formula: "999", reset: "long-rest" }] });
    const ctx = renderCtx([atWill], { featureUses: { "barbarian:rages": { used: 0, max: 999 } } });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([atWill]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    expect((rowByName(c, "Rage").nextElementSibling as HTMLElement).querySelector("button.pc-spend-control")).toBeNull();
    expect(rowByName(c, "Rage").querySelector("button.pc-spend-control")).toBeNull();
    expect(rowByName(c, "Rage").querySelector(".pc-charge-at-will")!.textContent).toBe("at will");
  });

  it("Lay on Hands, the owner-and-spender case at amount > 1: the control renders INSIDE the card", () => {
    // Spec §3.3 (e)'s second fixture, the positive half of the rule the Rage case pins negatively:
    // the feature owns the resource, so the row keeps its box tracker, but one box click spends 1
    // and the cost is 5, so the control renders in the expand card instead of the row.
    const loh = rf({ id: "lay-on-hands", name: "Lay on Hands", consumes: { resource: "paladin:lay-on-hands", amount: 5 },
      resources: [{ id: "paladin:lay-on-hands", name: "Lay on Hands", max_formula: "5", reset: "long-rest" }] });
    const ctx = renderCtx([loh], { featureUses: { "paladin:lay-on-hands": { used: 0, max: 5 } } });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([loh]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    const card = rowByName(c, "Lay on Hands").nextElementSibling as HTMLElement;
    expect(card.querySelector("button.pc-spend-control")!.textContent).toBe("Spend 5 Lay on Hands");
    expect(rowByName(c, "Lay on Hands").querySelector("button.pc-spend-control")).toBeNull();
    expect(rowByName(c, "Lay on Hands").querySelectorAll(".archivist-toggle-box").length).toBe(5);
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

// ─────────────────────────────────────────────────────────────
// R4-G4 §9.4 · the two SELF-subject kinds that carried a `condition` and no
// caption. `sense` and `proficiency` are folded by the engine (a sense lands on
// the senses panel, a proficiency on the proficiencies panel), but the QUALIFIER
// on either is dropped there: the row is the only place it can be read.
//
// The `sense` arm's fields are `type` + `range` (dnd5e types/feature-effect.ts;
// there is no `value` on that arm), and `range` is required by the schema, so
// the caption always has a number to print.
// ─────────────────────────────────────────────────────────────
describe("R4-G4 §9.4 · proficiency and sense condition captions", () => {
  it("R4-G4 §9.4: a SELF-subject sense effect and a SELF-subject proficiency effect each render a caption", () => {
    const { row } = renderOne({
      id: "x", name: "Umbral Sight", effects: [
        { kind: "sense", type: "darkvision", range: 60, condition: "while in dim light" },
        { kind: "proficiency", proficiency_type: "weapon", value: "longsword", condition: "while attuned" },
      ] as FeatureEffect[],
    });
    expect(captions(row)).toEqual([
      "darkvision 60 ft., while in dim light",
      "longsword proficiency, while attuned",
    ]);
    // No tooltip on either: the qualifier is already IN the body, and this file's
    // apply-condition test states the same rule from the other direction ·
    // echoing a visible line into a hover repeats it.
    for (const span of Array.from(row.querySelectorAll(".pc-feature-effect"))) {
      expect(span.getAttribute("aria-label")).toBeNull();
    }
  });

  it("R4-G4 §9.4: without a condition neither kind captions at all", () => {
    // The condition IS the caption's reason to exist: both kinds already have a
    // derived surface (the senses panel, the proficiencies panel), so an
    // unqualified one would be a duplicate row, not a rescued fact.
    const { row } = renderOne({
      id: "y", name: "Plain Darkvision", effects: [
        { kind: "sense", type: "darkvision", range: 60 },
        { kind: "proficiency", proficiency_type: "weapon", value: "longsword" },
      ] as FeatureEffect[],
    });
    expect(captions(row)).toEqual([]);
  });

  it("R4-G4 §9.4: a NON-self sense reads through the same restatement, not the field dump", () => {
    // `restate`'s new arm serves both paths, so the non-self caption cannot drift
    // into a second spelling of the same sentence.
    const { row } = renderOne({
      id: "z", name: "Granted Sight", effects: [
        { kind: "sense", type: "blindsight", range: 10, subject: "ally" },
      ] as FeatureEffect[],
    });
    expect(captions(row)).toEqual(["ally: blindsight 10 ft."]);
  });
});

// ── R4-G5 §4.3.1 · the ONE delta on the class feature row: the owner's die (§13 rows 19, 20) ──
// MEASURED at the base (research B §3.1): `renderFirstResourceTracker` never read `resource.die`, so a
// Bard 5's own Bardic Inspiration row showed three boxes and no die, while the SAME die was printed by
// `renderCardResource` and by `renderPoolHead`. Nothing else about the row moves: the activatable
// toggle and its duration caption stay in `.pc-action-namecell` (the Rage case below is the control).
describe("the owner-row die (R4-G5 §4.3.1)", () => {
  const bardicDie = (base: string, at5: string) => ({
    id: "bardic-inspiration", name: "Bardic Inspiration",
    resources: [{
      id: "bard:bardic-inspiration", name: "Bardic Inspiration", max_formula: "{cha_mod}",
      die: { base, scaling: { "5": at5, "10": "d10" } }, reset: "long-rest",
    }],
  });
  const bardRow = (base: string, at5: string): HTMLElement => {
    const bard = rf(bardicDie(base, at5), { source: { kind: "class", slug: "bard", level: 1 } });
    const ctx = renderCtx([bard], {
      // The OWNER's class level is 5 and the TOTAL is 10, so a reader that used `totalLevel` would
      // print the 10-step face instead: the fixture separates them on purpose.
      classes: [{ entity: { slug: "bard" }, level: 5 }, { entity: { slug: "fighter" }, level: 5 }],
      totalLevel: 10, featureUses: { "bard:bardic-inspiration": { used: 0, max: 3 } },
    });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([bard]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    return rowByName(c, "Bardic Inspiration").querySelector<HTMLElement>(".pc-feature-detail")!;
  };

  it("RED FIRST (row 19): a Bard 5 / Fighter 5 reads d8 on its own row, at the OWNER's level not the total", () => {
    const detail = bardRow("d6", "d8");
    expect(detail.querySelector(".pc-resource-die")!.textContent).toBe("d8");
    expect(detail.querySelectorAll(".pc-feature-track .archivist-toggle-box").length).toBe(3);
  });

  it("row 19: the 2024 corpus's own spelling travels verbatim (1d8), never a renderer-normalised face", () => {
    expect(bardRow("1d6", "1d8").querySelector(".pc-resource-die")!.textContent).toBe("1d8");
  });

  it("RED FIRST (row 20): the die span precedes the track, as it does at the two shipped die sites", () => {
    // The detail slot holds exactly these two children for this fixture: the feature owns its resource
    // and consumes nothing, so no spend control, and `hasTracker` moves the attack note to the card.
    expect(Array.from(bardRow("d6", "d8").children).map((n) => n.className))
      .toEqual(["pc-resource-die", "pc-feature-track"]);
  });

  it("a die-less feature row grows no die span (the control that keeps row 19 non-vacuous)", () => {
    const wind = rf({ id: "second-wind", name: "Second Wind",
      resources: [{ id: "fighter:second-wind", name: "Second Wind", max_formula: "1", reset: "short-rest" }] });
    const ctx = renderCtx([wind], { featureUses: { "fighter:second-wind": { used: 0, max: 1 } } });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([wind]);
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, ctx);
    expect(rowByName(c, "Second Wind").querySelector(".pc-resource-die")).toBeNull();
  });
});
