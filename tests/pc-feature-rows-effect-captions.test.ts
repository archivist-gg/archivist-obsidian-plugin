/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PassiveFeaturesTab } from "../packages/obsidian/src/modules/pc/components/passive-features-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { recalc } from "@archivist-gg/dnd5e/pc/pc.recalc";
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
// `DOM.Iterable`, so `[...querySelectorAll(…)]` is a tsc error (20 of them in
// the file this builder came from).
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
      totalLevel: 5, features, pools: opts.pools ?? [],
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
